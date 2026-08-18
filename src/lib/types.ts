export type Lang = 'en' | 'ta';

export type Mode = 'typing' | 'blanks' | 'voice' | 'listening';

export interface Verse {
  v: number;
  text: string;
}

export interface Chapter {
  chapter: number;
  verses: Verse[];
}

export interface Dataset {
  lang: Lang;
  version: string;
  versionLabel: string;
  license: string;
  book: string;
  bookId: string;
  chapters: Chapter[];
}

export interface VerseRef {
  chapter: number;
  verse: number;
}

export interface Range {
  start: VerseRef;
  end: VerseRef;
}
