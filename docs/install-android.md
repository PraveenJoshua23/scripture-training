# Installing Scripture Training on an Android phone

For someone who has been handed the app file and wants it on their phone. No
developer tools needed — you do not need Android Studio, and you do not need to
be the person who built it.

The file is called `app-debug.apk` and is about **78 MB**.

## Before you start

- **Android 7.0 or newer.** Anything from 2016 onwards.
- **About 200 MB free while installing.** The app itself settles at ~78 MB
  (measured on a Galaxy S24), but the downloaded copy sits in Downloads
  alongside it until you delete it.
- The app is **not on the Play Store**, so Android will warn you while
  installing. That warning is expected and is explained below.

## Getting the file onto the phone

Any way you would move a photo works — WhatsApp, Google Drive, email to
yourself, a USB cable. Two that need no accounts:

**Over wifi.** On the computer holding the file, in that folder, run:

```bash
python3 -m http.server 8000
```

It prints nothing useful; leave it running. On the phone, open the browser and
go to `http://<computer's IP>:8000/app-debug.apk`, then tap the file to
download it. The computer's IP is in System Settings → Wi-Fi → Details on a
Mac. Press `Ctrl+C` in the terminal when the phone has it.

Both devices must be on the same wifi network.

**Over USB**, if the computer has the Android platform tools:

```bash
adb install -r app-debug.apk
```

This one installs the app directly — skip the next section entirely.

## Installing it

1. Open the downloaded `app-debug.apk` (Files → Downloads, or tap the download
   notification).
2. Android says something like **"For your security, your phone is not allowed
   to install unknown apps from this source."** Tap **Settings** in that
   message.
3. Turn on **Allow from this source**, then go back.
4. Tap **Install**.
5. Play Protect may add **"Unsafe app blocked"** or offer to scan the app.
   Choose **Install anyway** / **Don't send**.

Those two warnings appear for every app that did not come from the Play Store.
They mean Google has not reviewed this file, not that anything is wrong with
it. Only install a build you were given by someone you trust.

The app appears as **Scripture Training**.

## What works without a connection

Everything except one screen. Typing, fill-in-the-blank, the test, the missed
verses notebook and progress are all on the phone, and **Tamil listening plays
from audio bundled inside the app** — that is most of the 78 MB.

**Voice recitation needs a connection.** The recording is sent away to be
transcribed, so that screen alone will not work on a plane or with mobile data
off. It also asks for **microphone permission** the first time; say yes, or the
screen cannot hear anything.

English listening uses the phone's own text-to-speech engine rather than
bundled audio. Most phones have one. If English listening is silent while Tamil
works, install **Speech Recognition & Synthesis** from the Play Store, or check
Settings → Accessibility → Text-to-speech output.

## Updating it later

Install the new file the same way, straight over the top. Progress, streak and
settings are kept — they live on the phone, not in the app file. The permission
from step 3 is remembered, so later installs are just Download → Install.

## Uninstalling

Long-press the app icon → **Uninstall**, or Settings → Apps → Scripture
Training → Uninstall. This deletes all progress, and there is no account or
backup to restore it from.
