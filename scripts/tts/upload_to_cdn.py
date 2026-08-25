#!/usr/bin/env python3
"""
Upload generated verse MP3s to S3-compatible storage (AWS S3 or Cloudflare R2
use the same boto3 client — just point ENDPOINT_URL at R2 if using that).

Usage:
    export CDN_BUCKET="your-bucket-name"
    export AWS_ACCESS_KEY_ID="..."
    export AWS_SECRET_ACCESS_KEY="..."
    export AWS_REGION="auto"                 # "auto" for R2, e.g. "us-east-1" for S3
    export CDN_ENDPOINT_URL=""               # leave blank for AWS S3;
                                              # e.g. https://<account_id>.r2.cloudflarestorage.com for R2
    export CDN_PUBLIC_BASE_URL="https://cdn.example.com"  # public URL prefix for the bucket

    python upload_to_cdn.py

Reads output/generation_manifest.json (written by tts_generate.py) and
uploads each successfully-generated file to:
    audio/tamil/revelation/4/revelation_4_v{n}.mp3

Writes output/upload_manifest.json mapping verse -> public CDN URL,
consumed by update_mapping.py.
"""

import os
import sys
import json
import boto3
from botocore.exceptions import ClientError

from _env import load_env

load_env()

MANIFEST_IN = "output/generation_manifest.json"
MANIFEST_OUT = "output/upload_manifest.json"
CDN_PATH_PREFIX_TMPL = "audio/tamil/{book}/{chapter}"

# Cloudflare R2 does not implement S3 ACLs and rejects ACL:public-read; modern
# AWS S3 buckets with "bucket owner enforced" ownership reject it too. Public
# access there is granted by bucket policy / custom domain, not per-object ACL.
# Set CDN_SET_PUBLIC_ACL=1 only for a legacy bucket that actually needs it.
SET_PUBLIC_ACL = os.environ.get("CDN_SET_PUBLIC_ACL") == "1"


def get_env_or_die(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: environment variable {name} is not set.", file=sys.stderr)
        sys.exit(1)
    return val


def build_s3_client():
    bucket = get_env_or_die("CDN_BUCKET")
    region = os.environ.get("AWS_REGION", "auto")
    endpoint_url = os.environ.get("CDN_ENDPOINT_URL") or None  # None -> real AWS S3

    session = boto3.session.Session()
    client = session.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint_url,  # set for R2; leave unset for AWS S3
    )
    return client, bucket


def main():
    if not os.path.exists(MANIFEST_IN):
        print(f"ERROR: {MANIFEST_IN} not found. Run tts_generate.py first.", file=sys.stderr)
        sys.exit(1)

    public_base = get_env_or_die("CDN_PUBLIC_BASE_URL").rstrip("/")
    client, bucket = build_s3_client()

    with open(MANIFEST_IN, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    book = manifest["book"]
    chapter = manifest["chapter"]
    path_prefix = CDN_PATH_PREFIX_TMPL.format(book=book, chapter=chapter)
    to_upload = [r for r in manifest["results"] if r["status"] == "ok"]
    print(f"Uploading {len(to_upload)} file(s) to bucket '{bucket}'...")

    upload_results = []
    for r in to_upload:
        n = r["verse"]
        local_path = r["file"]
        filename = os.path.basename(local_path)
        key = f"{path_prefix}/{filename}"

        print(f"  Verse {n}: uploading {local_path} -> s3://{bucket}/{key} ...", end=" ", flush=True)
        try:
            extra = {"ContentType": "audio/mpeg"}
            if SET_PUBLIC_ACL:
                extra["ACL"] = "public-read"
            client.upload_file(local_path, bucket, key, ExtraArgs=extra)
            public_url = f"{public_base}/{key}"
            print(f"OK -> {public_url}")
            upload_results.append({"verse": n, "key": key, "url": public_url, "status": "ok"})
        except ClientError as e:
            print(f"FAILED: {e}")
            upload_results.append({"verse": n, "key": key, "url": None, "status": "failed", "error": str(e)})

    with open(MANIFEST_OUT, "w", encoding="utf-8") as f:
        json.dump({"book": book, "chapter": chapter, "results": upload_results}, f,
                  ensure_ascii=False, indent=2)

    ok_count = sum(1 for r in upload_results if r["status"] == "ok")
    print(f"\nDone: {ok_count}/{len(upload_results)} uploaded.")
    print(f"Manifest written to {MANIFEST_OUT}")

    if ok_count < len(upload_results):
        sys.exit(1)


if __name__ == "__main__":
    main()
