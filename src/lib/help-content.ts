import type { Lang } from './types';

/**
 * Copy for the /help page. The structure is written once and both languages sit
 * side by side, so a change to one is hard to make without seeing the other.
 *
 * Step lists are positional: step 1 describes marker 1 of the shot it follows,
 * and the markers themselves come from `help-hotspots.json`, which the capture
 * script writes by measuring the real page. Adding a step means adding a
 * `data-help` mark to `scripts/capture-help.ts` in the same position.
 *
 * Keep the language plain: one instruction per step, verb first, no jargon.
 * This page is for readers who have never used an app like this before.
 */

export interface Localised {
  en: string;
  ta: string;
}

const s = (en: string, ta: string): Localised => ({ en, ta });

export function pick(value: Localised, lang: Lang): string {
  return value[lang] ?? value.en;
}

export type Block =
  | { kind: 'shot'; shot: string; steps: Localised[] }
  | { kind: 'gallery'; items: { shot: string; label: Localised; text: Localised }[] }
  | { kind: 'list'; title: Localised; items: Localised[] }
  | { kind: 'note'; text: Localised };

export interface HelpSection {
  id: string;
  emoji: string;
  title: Localised;
  intro: Localised;
  blocks: Block[];
}

const TROUBLE = s('If something goes wrong', 'ஏதேனும் சிக்கல் என்றால்');

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'start',
    emoji: '🏠',
    title: s('Start here', 'இங்கே தொடங்குங்கள்'),
    intro: s(
      'This app helps you learn Bible verses by heart. There is nothing to sign up for, and your progress is saved on this device.',
      'இந்தச் செயலி வேத வசனங்களை மனப்பாடம் செய்ய உதவுகிறது. பதிவு செய்ய வேண்டியதில்லை; உங்கள் முன்னேற்றம் இந்தச் சாதனத்திலேயே சேமிக்கப்படும்.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'home',
        steps: [
          s(
            'The row of names at the top takes you to each way of practising. Tap one to begin.',
            'மேலே உள்ள பெயர்கள் ஒவ்வொரு பயிற்சி முறைக்கும் அழைத்துச் செல்லும். ஒன்றைத் தொட்டுத் தொடங்குங்கள்.',
          ),
          s(
            'Tap EN for English or தமிழ் for Tamil. The verse changes language straight away.',
            'ஆங்கிலத்திற்கு EN, தமிழுக்கு தமிழ் என்பதைத் தொடுங்கள். வசனம் உடனே மொழி மாறும்.',
          ),
          s(
            'Tap the moon for a dark screen at night, and the sun for a bright screen.',
            'இரவில் இருண்ட திரைக்கு நிலவைத் தொடுங்கள்; ஒளிரும் திரைக்கு சூரியனைத் தொடுங்கள்.',
          ),
          s(
            'This counts the days in a row you have practised. Finish one verse today to keep it going.',
            'தொடர்ந்து எத்தனை நாட்கள் பயிற்சி செய்தீர்கள் என்பதைக் காட்டும். இன்று ஒரு வசனம் முடித்தால் தொடர் நீடிக்கும்.',
          ),
          s(
            'The bar fills up as you finish more verses.',
            'வசனங்களை முடிக்க முடிக்க இந்தக் கோடு நிரம்பும்.',
          ),
          s(
            'How many verses you have finished in each way of practising.',
            'ஒவ்வொரு பயிற்சி முறையிலும் நீங்கள் முடித்த வசனங்களின் எண்ணிக்கை.',
          ),
          s(
            'One box for each chapter. A box fills from the bottom as you finish its verses. Tap a box to start there.',
            'ஒவ்வொரு அதிகாரத்திற்கும் ஒரு கட்டம். அதன் வசனங்களை முடிக்க முடிக்க கட்டம் கீழிருந்து நிரம்பும். ஒரு கட்டத்தைத் தொட்டால் அங்கிருந்து தொடங்கலாம்.',
          ),
        ],
      },
      {
        kind: 'note',
        text: s(
          'Practise a little every day rather than a lot in one sitting. One verse is enough to keep your streak alive.',
          'ஒரே நாளில் அதிகம் செய்வதைவிட, தினமும் கொஞ்சம் பயிற்சி செய்வது நல்லது. தொடரைக் காக்க ஒரு வசனமே போதும்.',
        ),
      },
    ],
  },

  {
    id: 'controls',
    emoji: '🔘',
    title: s('Buttons on every practice screen', 'எல்லாப் பயிற்சித் திரையிலும் உள்ள பொத்தான்கள்'),
    intro: s(
      'These buttons sit at the top of Typing, Fill in the blank, Voice recitation and Listening. They work the same way everywhere.',
      'தட்டச்சு, இடைவெளி நிரப்புதல், வாய்மொழி, கேட்டல் — நான்கிலும் இந்தப் பொத்தான்கள் மேலே இருக்கும். எல்லா இடத்திலும் ஒரே மாதிரி வேலை செய்யும்.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'basics',
        steps: [
          s(
            'Shows the verse you are on. Tap it to pick a different chapter and verse.',
            'நீங்கள் இருக்கும் வசனத்தைக் காட்டும். வேறு அதிகாரம் அல்லது வசனத்தைத் தேர்ந்தெடுக்க இதைத் தொடுங்கள்.',
          ),
          s('Go back one verse.', 'ஒரு வசனம் பின்னால் செல்லும்.'),
          s('Go on to the next verse.', 'அடுத்த வசனத்திற்குச் செல்லும்.'),
          s(
            'Press and hold to see the whole verse. Let go and it hides again.',
            'முழு வசனத்தையும் பார்க்க அழுத்திப் பிடியுங்கள். விட்டால் மறைந்துவிடும்.',
          ),
          s(
            'Tap A+ to make the words bigger, or A− to make them smaller.',
            'எழுத்துகளைப் பெரிதாக்க A+ ஐத் தொடுங்கள்; சிறிதாக்க A− ஐத் தொடுங்கள்.',
          ),
        ],
      },
    ],
  },

  {
    id: 'typing',
    emoji: '⌨️',
    title: s('Typing', 'தட்டச்சு'),
    intro: s(
      'Read the verse, then type it out. The words turn green as you get them right.',
      'வசனத்தைப் படித்துவிட்டு அதைத் தட்டச்சு செய்யுங்கள். சரியாக வரும் சொற்கள் பச்சை நிறமாக மாறும்.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'typing',
        steps: [
          s(
            'The verse you are copying. Each word changes colour as you type.',
            'நீங்கள் எழுத வேண்டிய வசனம். நீங்கள் தட்டச்சு செய்ய, ஒவ்வொரு சொல்லும் நிறம் மாறும்.',
          ),
          s(
            'How much you have right so far, and how fast you are typing.',
            'இதுவரை எவ்வளவு சரியாக உள்ளது, எவ்வளவு வேகமாகத் தட்டச்சு செய்கிறீர்கள் என்பது.',
          ),
          s(
            'Type here. Take your time — nothing is timed against you.',
            'இங்கே தட்டச்சு செய்யுங்கள். அவசரம் இல்லை — நேரம் கணக்கிடப்படவில்லை.',
          ),
          s(
            'Tap Check when you have finished. On a computer you can press Ctrl and Enter together instead.',
            "முடித்தபின் 'சரிபார்' என்பதைத் தொடுங்கள். கணினியில் Ctrl மற்றும் Enter ஐ ஒன்றாக அழுத்தலாம்.",
          ),
        ],
      },
      {
        kind: 'list',
        title: s('What the colours mean', 'நிறங்களின் பொருள்'),
        items: [
          s('Green — the word is right.', 'பச்சை — சொல் சரி.'),
          s('Red — the word is wrong or missing.', 'சிவப்பு — சொல் தவறு அல்லது விடுபட்டது.'),
          s('Grey — you have not typed it yet.', 'சாம்பல் — இன்னும் தட்டச்சு செய்யவில்லை.'),
        ],
      },
      {
        kind: 'list',
        title: TROUBLE,
        items: [
          s(
            'Typed the wrong word? Just fix it. Nothing is counted until you tap Check.',
            "தவறாகத் தட்டச்சு செய்துவிட்டீர்களா? திருத்திக் கொள்ளுங்கள். 'சரிபார்' தொடும் வரை எதுவும் கணக்கில் எடுக்கப்படாது.",
          ),
          s(
            'Want to see the verse again? Press and hold “Hold to peek”.',
            "வசனத்தை மீண்டும் பார்க்க வேண்டுமா? 'அழுத்திப் பார்க்க' என்பதை அழுத்திப் பிடியுங்கள்.",
          ),
        ],
      },
    ],
  },

  {
    id: 'blanks',
    emoji: '🧩',
    title: s('Fill in the blank', 'இடைவெளி நிரப்புதல்'),
    intro: s(
      'Some words are taken out of the verse and you put them back. There are five levels: level 1 is the easiest, and level 5 is from memory alone.',
      'வசனத்திலிருந்து சில சொற்கள் எடுக்கப்படும்; அவற்றை நீங்கள் மீண்டும் வைக்க வேண்டும். ஐந்து நிலைகள் உள்ளன: நிலை 1 மிக எளிது, நிலை 5 முழுக்க நினைவிலிருந்து.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'blanks1',
        steps: [
          s(
            'Pick a level. Start at 1 and move up when it starts to feel easy.',
            'ஒரு நிலையைத் தேர்ந்தெடுங்கள். 1 இல் தொடங்கி, எளிதாகத் தோன்றும்போது மேலே செல்லுங்கள்.',
          ),
          s(
            'Slide this to take out more words or fewer. 20% means about one word in five.',
            'அதிக அல்லது குறைவான சொற்களை எடுக்க இதை நகர்த்துங்கள். 20% என்றால் ஐந்தில் ஒரு சொல்.',
          ),
          s(
            'The verse with the gaps in it. Empty gaps are underlined.',
            'இடைவெளிகளுடன் கூடிய வசனம். காலி இடங்கள் கோடிட்டுக் காட்டப்படும்.',
          ),
          s(
            'The missing words. Tap a word, then tap the gap it belongs in. On a phone you can also drag it across.',
            'விடுபட்ட சொற்கள். ஒரு சொல்லைத் தொட்டு, பிறகு அது சேர வேண்டிய இடத்தைத் தொடுங்கள். கைபேசியில் இழுத்தும் வைக்கலாம்.',
          ),
        ],
      },
      {
        kind: 'note',
        text: s(
          'Put a word in the wrong gap? Tap that gap again and the word goes back to the list.',
          'சொல்லைத் தவறான இடத்தில் வைத்துவிட்டீர்களா? அந்த இடத்தை மீண்டும் தொட்டால் சொல் பட்டியலுக்குத் திரும்பும்.',
        ),
      },
      {
        kind: 'gallery',
        items: [
          {
            shot: 'blanks2',
            label: s('Level 2 — First letters', 'நிலை 2 — முதல் எழுத்து'),
            text: s(
              'The first letter of each missing word is shown. Type the rest.',
              'விடுபட்ட ஒவ்வொரு சொல்லின் முதல் எழுத்து காட்டப்படும். மீதியைத் தட்டச்சு செய்யுங்கள்.',
            ),
          },
          {
            shot: 'blanks3',
            label: s('Level 3 — Empty blanks', 'நிலை 3 — வெற்று இடம்'),
            text: s(
              'No help at all. Type each missing word yourself.',
              'எந்த உதவியும் இல்லை. விடுபட்ட சொற்களை நீங்களே தட்டச்சு செய்யுங்கள்.',
            ),
          },
          {
            shot: 'blanks4',
            label: s('Level 4 — Blank page', 'நிலை 4 — முழு வசனம்'),
            text: s(
              'Type the whole verse from memory.',
              'முழு வசனத்தையும் நினைவிலிருந்து தட்டச்சு செய்யுங்கள்.',
            ),
          },
          {
            shot: 'blanks5',
            label: s('Level 5 — Voice', 'நிலை 5 — குரல்'),
            text: s(
              'Say the whole verse out loud from memory.',
              'முழு வசனத்தையும் நினைவிலிருந்து சத்தமாகச் சொல்லுங்கள்.',
            ),
          },
        ],
      },
    ],
  },

  {
    id: 'voice',
    emoji: '🎤',
    title: s('Voice recitation', 'வாய்மொழி ஒப்புவித்தல்'),
    intro: s(
      'Say the verse out loud. The app writes down what it hears and compares it with the verse.',
      'வசனத்தைச் சத்தமாகச் சொல்லுங்கள். நீங்கள் சொல்வதை செயலி எழுதி, வசனத்தோடு ஒப்பிடும்.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'voice',
        steps: [
          s(
            'Tap “Start reciting” and say the verse. Tap “Stop” when you are done.',
            "'ஒப்புவிக்கத் தொடங்கு' என்பதைத் தொட்டு வசனத்தைச் சொல்லுங்கள். முடிந்ததும் 'நிறுத்து' என்பதைத் தொடுங்கள்.",
          ),
          s(
            'What the app heard you say. It appears here while you speak.',
            'செயலி கேட்டது இங்கே தெரியும். நீங்கள் பேசும்போதே வந்துகொண்டிருக்கும்.',
          ),
          s(
            'Tap Check to see how close you were.',
            "எவ்வளவு சரியாக இருந்தது என்று பார்க்க 'சரிபார்' என்பதைத் தொடுங்கள்.",
          ),
        ],
      },
      {
        kind: 'list',
        title: TROUBLE,
        items: [
          s(
            'The first time, your browser asks to use the microphone. Tap Allow.',
            "முதல் முறை, ஒலிவாங்கியைப் பயன்படுத்த உலாவி அனுமதி கேட்கும். 'Allow' என்பதைத் தொடுங்கள்.",
          ),
          s(
            'Nothing appearing? Speak a little louder, and closer to the phone.',
            'எதுவும் தெரியவில்லையா? சற்று சத்தமாக, கைபேசிக்கு அருகில் பேசுங்கள்.',
          ),
          s(
            'This needs Chrome, Edge or Safari. Some other browsers cannot listen at all.',
            'இதற்கு Chrome, Edge அல்லது Safari தேவை. வேறு சில உலாவிகளால் கேட்கவே முடியாது.',
          ),
        ],
      },
    ],
  },

  {
    id: 'listening',
    emoji: '🎧',
    title: s('Listening', 'கேட்டல்'),
    intro: s(
      'Let the verse be read to you while you follow along. Good for learning on a walk, or before bed.',
      'வசனத்தை உங்களுக்கு வாசித்துக் காட்டும்; நீங்கள் பின்தொடரலாம். நடக்கும்போதோ படுக்கும் முன்போ கற்க ஏற்றது.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'listening',
        steps: [
          s(
            'Choose Play for one verse, Repeat verse to hear the same verse again and again, or Play chapter to keep going to the end of the chapter.',
            "ஒரு வசனத்திற்கு 'இயக்கு', அதே வசனத்தை மீண்டும் மீண்டும் கேட்க 'வசனத்தை மீண்டும்', அதிகாரம் முழுவதும் தொடர 'அதிகாரத்தை இயக்கு' — ஒன்றைத் தேர்ந்தெடுங்கள்.",
          ),
          s(
            'Slide left to slow the reading down, right to speed it up.',
            'வாசிப்பை மெதுவாக்க இடப்புறமும், வேகமாக்க வலப்புறமும் நகர்த்துங்கள்.',
          ),
          s(
            'Tap Play to start, and Pause to stop.',
            "தொடங்க 'இயக்கு' என்பதைத் தொடுங்கள்; நிறுத்த 'இடைநிறுத்து'.",
          ),
          s(
            'Every verse in the chapter. Tap any one to jump straight to it.',
            'அதிகாரத்தின் எல்லா வசனங்களும். எதையேனும் தொட்டால் அங்கு செல்லலாம்.',
          ),
        ],
      },
      {
        kind: 'list',
        title: TROUBLE,
        items: [
          s(
            'No sound? Check that your phone is not on silent, and turn the volume up.',
            'ஒலி கேட்கவில்லையா? கைபேசி நிசப்த நிலையில் இல்லை என்பதைப் பாருங்கள்; ஒலியை அதிகரியுங்கள்.',
          ),
          s(
            'Hearing a verse all the way through counts it as practised.',
            'ஒரு வசனத்தை முழுவதுமாகக் கேட்டால் அது பயிற்சி செய்ததாகக் கணக்கிடப்படும்.',
          ),
        ],
      },
    ],
  },

  {
    id: 'test',
    emoji: '📝',
    title: s('Test', 'தேர்வு'),
    intro: s(
      'A test asks you to write several verses from memory, one after another. There is no peeking and no word bank.',
      'தேர்வில் பல வசனங்களை ஒன்றன்பின் ஒன்றாக நினைவிலிருந்து எழுத வேண்டும். எட்டிப்பார்க்க முடியாது; சொற்பட்டியலும் இல்லை.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'testSetup',
        steps: [
          s(
            'Choose the first and the last verse of the test.',
            'தேர்வின் முதல் மற்றும் கடைசி வசனத்தைத் தேர்ந்தெடுங்கள்.',
          ),
          s('How many verses that adds up to.', 'மொத்தம் எத்தனை வசனங்கள் என்பது.'),
          s(
            'Tap Start test when you are ready.',
            "தயாரானதும் 'தேர்வைத் தொடங்கு' என்பதைத் தொடுங்கள்.",
          ),
        ],
      },
      {
        kind: 'shot',
        shot: 'testRun',
        steps: [
          s(
            'Which verse you are on, out of the whole test.',
            'மொத்தத்தில் எத்தனையாவது வசனத்தில் இருக்கிறீர்கள் என்பது.',
          ),
          s('The bar fills as you go.', 'நீங்கள் முன்னேற முன்னேற இந்தக் கோடு நிரம்பும்.'),
          s(
            'The chapter and verse to write. Only the reference is shown — the words are up to you.',
            'எழுத வேண்டிய அதிகாரமும் வசனமும். குறிப்பு மட்டுமே காட்டப்படும் — சொற்கள் உங்கள் நினைவிலிருந்து.',
          ),
          s('Type the verse here.', 'வசனத்தை இங்கே தட்டச்சு செய்யுங்கள்.'),
          s(
            'Tap to go on. On the last verse this button says Finish.',
            "தொடர இதைத் தொடுங்கள். கடைசி வசனத்தில் இது 'முடி' எனக் காட்டும்.",
          ),
        ],
      },
      {
        kind: 'shot',
        shot: 'testResult',
        steps: [
          s(
            'Your average score, and how many verses you passed.',
            'உங்கள் சராசரி மதிப்பெண், எத்தனை வசனங்களில் தேர்ச்சி பெற்றீர்கள் என்பது.',
          ),
          s(
            'The verses you did not get right, word by word. Red words were wrong or missing.',
            'சரியாக வராத வசனங்கள், சொல் சொல்லாக. சிவப்புச் சொற்கள் தவறானவை அல்லது விடுபட்டவை.',
          ),
        ],
      },
    ],
  },

  {
    id: 'review',
    emoji: '🔁',
    title: s('Missed verses', 'தவறிய வசனங்கள்'),
    intro: s(
      'Any verse you get wrong is kept here, from every mode, so that you can come back to it.',
      'எந்தப் பயிற்சியிலும் தவறாக வரும் வசனம் இங்கே சேமிக்கப்படும்; பிறகு திரும்பி வரலாம்.',
    ),
    blocks: [
      {
        kind: 'shot',
        shot: 'review',
        steps: [
          s(
            'Each verse you missed, with the way you were practising and the score you got.',
            'நீங்கள் தவறவிட்ட ஒவ்வொரு வசனமும், எந்தப் பயிற்சியில் என்பதும், பெற்ற மதிப்பெண்ணும்.',
          ),
          s(
            'Tap to go straight to that verse and try it again.',
            'அந்த வசனத்திற்கு நேரடியாகச் சென்று மீண்டும் முயல இதைத் தொடுங்கள்.',
          ),
          s(
            'Empties the whole list. Use it when you want a fresh start.',
            'பட்டியல் முழுவதையும் காலி செய்யும். புதிதாகத் தொடங்க விரும்பினால் பயன்படுத்துங்கள்.',
          ),
        ],
      },
      {
        kind: 'note',
        text: s(
          'A verse leaves this list on its own once you get it right again.',
          'மீண்டும் சரியாகச் சொன்னால் அந்த வசனம் தானாகவே இந்தப் பட்டியலிலிருந்து நீங்கும்.',
        ),
      },
    ],
  },
];
