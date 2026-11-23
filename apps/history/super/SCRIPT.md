# Writing a film script

How to plan and write the words for a super-story, for any topic.
Made 22 Nov 2026 from the Mongols film and the edits Hari asked for on it.
Changed the same day after version B of the Mongols script (Hari: "b is nice"): fewer names, a choice in each chapter, a turn on "but", years on screen.
**Version B is now the film (`mongols.js`) and the model for the words.** The first cut is in git: `git show 51e1d61c:apps/history/super/mongols.js`.
The file format, actions and staging are in `README.md`. This file is only about the words.

Other sources:
- `~/Dropbox/happy-hari/reference/writing.md`: the test every script must pass (true, important, new, strong).
- `~/Dropbox/happy-hari/reference/historia-civilis-videos.md`: the video format this follows.
- `~/history-video/explainers/README.md`: the list of topics.

## The size to aim for

The Mongols film, as recorded:

| | Number |
|---|---|
| Chapters | 11 |
| Lines | 146 (about 13 a chapter) |
| Words | 5,836 |
| Words a line | 40 typical, 14 shortest, 74 longest |
| Sentences a line | about 3.4 |
| Seconds a line | 13.5 typical |
| Speaking speed | 2.8 words a second |
| Length | 38 minutes |

To size a new film: minutes × 155 = words. Words ÷ 40 = lines.
A line over 60 words is two lines. A line under 15 words needs a strong picture to stand alone.

What to count in the words, and where version B landed:

| | First cut | Version B | Aim for |
|---|---|---|---|
| Capitalised words per 1,000 (names of people and places) | 46 | 27 | under 30 |
| "but" | 10 | 47 | 3 to 6 a chapter |
| "so" | 11 | 32 | 2 to 5 a chapter |
| Years said aloud | 69 | 6 | the anchors only |
| Words | 5,471 | 5,836 | |
| Speech | 34.2 min | 34.6 min | |

Fewer years pay for the extra words: a year takes a long time to say.

## 1. Plan before writing

Do these in order. Write nothing in the story file until step 5 is done.

1. **One question.** The film answers a single question the viewer can hold in their head.
   - Mongols: "About a million herders build the largest land empire in history. How?"
   - The question is said in the first line.
   - Bad: "the history of the Mongols". That is a topic, not a question.
2. **Three answers.** Write the answer as two to four short reasons before writing any chapter.
   - Mongols: every man a mounted archer; command went to the able; they took every skill their enemies had.
   - Each reason must show up in a scene at least once, named as a reason ("This is the first reason he wins").
   - The last line of the film says all of them again in one sentence.
3. **Sources.** Pick two or three, and say which.
   - One primary source in a named translation, for quotes.
   - One modern history, for dates, numbers and what is disputed.
   - Mark every fact written from memory and check it before recording. Tell Hari which ones were not checked.
4. **Chapter list.** 8 to 12 chapters, each one line here:
   - the person it opens on
   - the single change it shows (a state before, a state after)
   - the choice someone makes in it: the options, and the pick (section 2)
   - the turn: what was expected, and what happened instead
   - which of the reasons it carries, if any
   - the hook it ends on
5. **Line list.** For each chapter, 10 to 15 lines as one phrase each: what is said, and what is seen.
   - If nothing can be seen, cut the line or join it to a neighbour.
   - Mark which lines are close-ups and which are the wide map. Aim for more than a third close-ups.
6. **Cast and places.** List every name the script will use. For each, write the five-word tag it gets on first use (see section 3).
   - Mark each name: decides something, comes back later, or neither. "Neither" gets a role, not a name: "a general", "his brother" (section 3).
   - More than about 25 named people is too many.

## 2. The shape of a chapter

- **Open close on one person.** A place, a year, someone doing something. "It is 1206. We are on the Onon river."
- **Pull back.** Show what that moment changes on the map.
- **Show a choice.** At least once a chapter, someone has options. Say the options, what each costs, then the pick.
  - "He has no army. He can give her up, or go after her and die. So he does a third thing: he asks two stronger men for theirs."
  - "The shah can hand over his mother's kinsman, or insult the khan. He kills one envoy and shaves the beards of the others."
  - "Some commanders want to clear out its farmers and turn it into pasture. Yelü Chucai argues the other way: leave them on the land, tax them."
  - Only a choice the person really had. Do not invent a dilemma (section 6).
- **Turn at least once.** Something is expected, **but** something else happens. A chapter that only goes "then, then, then" is a list.
  - "It should be the end of them. But Hö'elün keeps them alive."
  - "By morning the camp is ringed and under fire. But trapped men fight to the death, and that costs the attacker. So the Mongols open a gap."
- **Say why.** One sentence, somewhere in the chapter, that gives the cause or the result. This is what the viewer keeps.
- **End on a hook.** One line that makes the next chapter needed. Marked `hook: true`.

The first chapter also states the question. The last chapter also states the answer.

## 3. Names: fewer, and never without context

**First: does the viewer need the name?**

- Say a name only for someone who decides something, or who comes back later. Everyone else gets a role.
- A place said once goes on the map as a mark, not in the voice.
- The face and its label can stay on screen without the name being said: add `{who: "id"}` to the line.
- A witness the film quotes keeps the name (Juvayni, Marco Polo).

| Was | Now |
|---|---|
| "His father's kin, the Tayichi'ud, pack up and move off down the Onon." | "So they pack up and move off down the river." |
| "His envoys demand Inalchuq. Shah Muhammad II kills one envoy…" | "His envoys demand one man: the governor. … He kills one envoy…" |
| "At Parwan, north of Kabul, he beats a Mongol army under Shigi Qutuqu, the judge." | "North of Kabul he does what his father never tried: he meets a Mongol army in the field, and beats it." |
| "On 9 April, at Legnica, it destroys the army of Duke Henry of Silesia." | "…and destroys a Polish duke's army there." |
| "The princes of Kiev, Galich and Chernigov agree to march." | "Three of the princes agree to march." |

**Then: tag the names that stay.**

The fault Hari found most often: a name used as if the viewer knew it.

**Rule: the first time a name is said, say what it is, in the same sentence.**

| Kind | Was | Now |
|---|---|---|
| A book | "The Secret History says…" | "The Secret History, a chronicle written for his family some years after his death, says…" |
| A mountain | "hides on Burkhan Khaldun" | "hides on the mountain Burkhan Khaldun" |
| A range, a desert, a river | "from the Altai to the Khingan" | "from the Altai mountains to the Khingan range" |
| A people | "Tatars poison Yesügei" | "men of the Tatars, old enemies, poison Yesügei" |
| A kingdom | "the Shah of Khwarazm" | "the Shah of Khwarazm, who rules from Iran to Central Asia" |
| A region | "Tolui takes Khurasan" | "Tolui takes Khurasan, the rich east of Iran" |
| A person | "with Jebe and Subutai" | "with two generals, Jebe and Subutai" |
| A relation | "Chagatai and Ögedei besiege" | "Two of his sons, Chagatai and Ögedei, besiege" |
| A term | "sets relay posts" | "sets up the yam: relay posts" |
| A later name | "khan of the Golden Horde" | "Batu's realm on the Volga is now called the Golden Horde" |

- After the first use, the short name alone is fine within the chapter.
- If a name comes back three chapters later, tag it again in two or three words ("Yelü Chucai, the adviser from Zhongdu").
- A past event the line depends on gets one sentence first. "Years before, Yesügei had carried off Hö'elün from a Merkit bridegroom. Now Merkit riders raid the camp in revenge."
- Do not use a label the viewer has not been given. "The Khitan adviser" meant nothing; "the adviser from Zhongdu" did.

**Check:** read the script as someone who has never heard of the topic. Circle every capitalised word. Each needs its tag at first use.

## 4. Make each line worth hearing

A line that only says what happened is half a line. Add the reason or the result.

| Was | Now |
|---|---|
| "Loot is shared out after the fight, not grabbed during it." | "Loot is shared out after the fight, so no one stops fighting to grab it." |
| "A beaten clan is split up and taken in." | "A beaten clan is split up and taken in, so it cannot rise again." |
| (the great hunt, described) | adds "It teaches thousands of riders to move as one line." |
| "It ends with borrowed skill, like so much else." | "It ends with borrowed skill. The Mongols did not invent siege engines. They hired the men who built the best ones." |
| (Möngke dies) | adds "It is the empire's weak point: when a Great Khan dies, the princes go home to choose the next one, and the conquests stop." |

- Useful joining words: **so**, **because**, **but**, **which means**, **this is why**.
- "But" marks a turn; "so" marks what follows from it. The first cut had 10 "but" in 37 minutes, and it sounded like a list.
- One such sentence a chapter is the minimum. Not every line: a film of morals is tiring.
- Prefer the fact a smart viewer would not know to the one they would guess.
- Cut vague closers: "like so much else", "and the rest is history", "little did they know".

## 5. Words to use

- **Plain words.** A tired viewer gets it on first hearing. "Rules" not "holds sway over". "Beats" not "prevails against".
- **Short sentences.** One idea each. A long list becomes three sentences (the Otrar line).
- **Present tense for scenes**, past tense for background.
- **Say the kind of thing with the name**: "the Kyzylkum desert", "the town of Nur", "the Tang dynasty".
- **Years go on screen, not in the voice.** The `year` action shows the year. Say a year aloud only as an anchor (Mongols: 1206, 1227, 1368).
  - Otherwise say the time in plain words: "that winter", "four years later", "the next summer", "before the year is out".
  - Was: "By 1264 Ariq Böke's men are starving." Now: "Four years later Ariq Böke's men are starving."
- **Numbers the ear can hold.** "About a million", "three or four horses a rider". Not "between 700,000 and 1.2 million": that goes in a chip.
- **Commit.** "Probably" where it is honestly uncertain; never "may well have", "it could be argued", "some would say".
- **No throat-clearing.** Not "Now we turn to", "It is worth noting", "As we shall see".
- **Do not say a fact twice** (Carpini "in his sixties" was said in two lines).
- **Written for a voice.** The narrator is a machine. Read every line aloud. Avoid brackets, long lists and words that only work on the page.

## 6. Being right

- **Quotes** are the exact words of a published translation, with section or page. Never from a podcast, never tidied.
- **A disputed number** is said plainly in the line and given its range in a `chip`.
- **A legend** is called a legend, or given to its source ("The Secret History says…").
- **A claim about why** something happened is the script's own argument. Keep it to what the sources support.
- **A choice** is the same kind of claim. The options must be ones the source gives, or that the person plainly had. Check the motive like a fact.
  - Checked for version B: Genghis will not turn back because "the Tangqut people will say that our hearts have failed us" (Secret History §265). The two elder sons themselves settle on Ögedei (§255).
- One chip and one quote a line at most.

## 7. Edit passes

Do them one at a time, in this order. Each pass looks for one thing.

1. **Names.** Cut every name the viewer does not need, then check each one left is tagged at first use (section 3).
2. **Choice and turn.** Every chapter shows one choice and has at least one "but" (section 2).
3. **So what.** Every chapter has its reason sentence, and the film's reasons are each named once (section 4).
4. **Years.** Take the years out of the voice, except the anchors (section 5).
5. **PG test.** For each line: is it true, does it matter, is it new, is it stated strongly? Cut or fix what fails.
6. **Cut.** Hedges, throat-clearing, repeats, anything the picture already says.
7. **Aloud.** Record it (`_tools/ssvoice/gen.py`), then transcribe a few clips back and read them. Fix what the voice trips on.
8. **With the pictures.** Watch each chapter once. A sentence the screen cannot show is cut or moved.
   - A person whose name was cut still needs their face: check who drops off screen, and add `{who: "id"}`.
   - Keep the order of events inside a line: the pictures are timed to the sentences.

Then count (the table in "The size to aim for"): names per 1,000 words, "but", "so", years said aloud.

After any change to a `say`, record again: only changed lines are re-recorded.
Give Hari the changes as a before and after list in the chat, numbered, in film order.

## 8. What goes wrong

| Fault | Fix |
|---|---|
| Too many names | keep the people who decide; the rest get a role, and places go on the map |
| A name with no context | tag it in the same sentence |
| A chapter of "then, then, then" | show one choice (options, cost, pick) and turn once on "but" |
| Years read aloud | the `year` action shows them; say only the anchors |
| The film has no question | write the question and put it in line one |
| Events with no reasons | add "so" or "because" to one line a chapter |
| A line nothing can show | cut it or join it |
| A fact from memory, unchecked | check it, or tell Hari it was not checked |
| The ending just stops | the last line gives the answer |
| The same fact twice | keep the better place |
| A label only an expert knows | use the plain one |
