# =========================================================================
# Classroom of the Elite - Volume 1 : playable script
# Condensed from data/cote_1_extracted.txt into interactive scenes.
# One instruction per line, '|' separates arguments. '#' = comment.
# See StoryLoader.java for the full directive reference.
# =========================================================================

# ---------------------------------------------------------------- Chapter 1
CHAPTER 1|The Structure of Japanese Society
TELEPORT 0|1.4|86
TIME 07:40
NARR Are people equal or not? A proper society constantly strives for equality. But if abilities differ, roles differ too. To be human is to be unequal.
NARR Long ago a great man said heaven does not set one man above or below any other. Yet he also said education creates the difference. Equality does not exist.
NARR My name is Kiyotaka Ayanokouji. Today is the entrance ceremony of Tokyo Metropolitan Advanced Nurturing High School, a boarding school funded by the government.
NARR It boasts a one hundred percent record of university placement and career placement. For three years, everything we need will supposedly be provided.
TITLE April - Entrance Day|Walk toward the school bus stop.

# ---------------------------------------------------------------- Chapter 2
CHAPTER 2|Welcome to the School Life of Your Dreams
OBJ Head to the bus stop by the Main Gate.
CMD horikita|gate
CMD kushida|gate
GOTO gate|5
NARR The bus arrived... and drove straight past the stop without opening its doors. Only students are permitted to board, and apparently we were late in their eyes.
NPC horikita|So the buses only run when they please. How troublesome. I suppose we walk.
ME Do you always say exactly what you think?
NPC horikita|I merely see no reason to lie. We should hurry. Homeroom starts soon.
NPC kushida|Hey, hey! You're Ayanokouji-kun, right? I'm Kushida Kikyou! Since we're in the same class, let's be friends!
CHOICE She's holding out her phone.|Exchange contacts|Keep it distant|Just nod quietly
RESPONSE 0|me|Sure, why not. I gave her my contact information. Her smile could light up the whole campus.|kushida_contact
RESPONSE 1|kushida|Aw, don't be like that! Come on, everyone exchanges contacts on day one!
RESPONSE 2|kushida|Silent type, huh? That's okay! I'll drag you into the fun eventually!
NPC horikita|Do as you like. Don't decide we are friends just because we walked together.
TIME 08:15
OBJ Attend homeroom in Class 1-D.
GOTO classroom|14
NPC chabashira|Settle down. I am Chabashira Sae, homeroom teacher of Class D. Congratulations on entering. Here we value merit above all.
NPC chabashira|This campus is self-contained. Leaving requires permission, outside contact is restricted, and everything from food to entertainment is purchased with private points.
NPC chabashira|This month every student receives 100,000 points. Points behave exactly like yen anywhere on campus. Spend them freely.
CHOICE 100,000 yen a month... free money?|Ask why so generous|Stay silent|Whistle innocently
RESPONSE 0|chabashira|The school provides full support so you can focus purely on growth. Nothing more, nothing less. Any other questions?
RESPONSE 1|chabashira|Wise. Not everything free is without a price. Remember that, even if you understand it only much later.
RESPONSE 2|chabashira|Control yourself. Some of your classmates already ordered fifty drinks this morning.
NARR A school where money falls from the sky. Paradise. Or so it seemed that morning.

# ---------------------------------------------------------------- Chapter 3
CHAPTER 3|The Students of Class D
TITLE The next day
TIME 08:30
OBJ Sit through another morning of class.
GOTO classroom|14
NARR Day two of actual lessons. Sudou was already asleep. Ike and Yamauchi were planning something loud. The teachers simply did not care whether we listened.
NPC sudou|Hn... what page are we on?
NPC ike|Bro, this school is the best! Free points, free rooms, and co-ed swimming classes coming up!
NPC yamauchi|Ike, my friend, we have ascended to paradise!
NPC horikita|Pathetic. All three of you.
ME You again? Do you ever say anything nice?
NPC horikita|I state facts. Unlike you, at least I have no interest in being liked.
TIME 12:00
OBJ Grab lunch at the cafeteria.
GOTO cafeteria|10
NPC hirata|I'm heading to the cafeteria. Anyone want to come along?
NARR Hands shot up instantly, mostly girls'. Hirata is the class's sun; everyone orbits him. My half-raised hand sank back down unnoticed.
NPC horikita|How tragic. Your thoughts are an open book, Ayanokouji-kun.
ME Says the girl eating alone in the corner.
NPC horikita|Alone by choice. There is a difference.
NPC kushida|Ayanokouji-kun! Come sit with us! Horikita-san, you too!
CHOICE Lunch companions?|Join Kushida's table|Sit alone anyway|Follow Horikita's example
RESPONSE 0|kushida|Yay! See? This is what school is about. Friends, food, and fun!
RESPONSE 1|narr|I ate my noodles pretending nobody noticed me. Being invisible is also a skill.
RESPONSE 2|narr|I sat alone. Solitude was quieter, though not entirely unpleasant.

# ---------------------------------------------------------------- Chapter 4
CHAPTER 4|Ladies and Gentlemen, Thank You for Waiting
TITLE About a week later
TIME 08:30
OBJ Another morning in Class 1-D.
GOTO classroom|14
NPC ike|Professor! Record the swimming class for science! Scientific curiosity!
NPC sotomura|L-leave it to me. I'll pretend to be sick and observe... for research.
NPC sudou|You idiots will get us all in trouble. Tch.
NPC horikita|Ayanokouji-kun. If you want friends so badly, why not simply talk to them?
ME It's complicated. There are... reasons.
NPC horikita|Excuses. You're the only person I speak with, and that is already more than enough for me.
TIME 16:00
OBJ Pick up supplies at the convenience store.
GOTO store|9
NARR At the Keyaki Mall convenience store I ran into someone unexpected: Sudou, arms piled high with instant meals and snacks.
NPC sudou|What? Never seen a guy shop before? Points burn holes in pockets. Got a problem with that?
ME No problem. Just surprised you eat all of that.
NPC sudou|Basketball burns it off. I'm going pro one day. Remember the name Sudou Ken.
NARR Loud, rude, and oddly straightforward. Hard to hate. He left with his mountain of food.
TIME 17:00
OBJ Check out the club fair at the Gymnasium.
GOTO gym|10
SPAWN manabu|52|22|180
NARR The club fair buzzed across the gym floor. Near the entrance stood a student surrounded by deference itself.
NPC manabu|I am the student council president. Horikita Manabu.
ME Horikita? Same surname as that Horikita... coincidence?
NPC manabu|The council recruits candidates with excellent grades and conduct. Those who would sully this school need not apply.
NARR His eyes swept over me like a scanner sorting defects. Whatever he measured, I apparently measured zero interest to him.
DESPAWN manabu

# ---------------------------------------------------------------- Chapter 5
CHAPTER 5|Friends
TITLE Three weeks after entrance
TIME 15:30
OBJ Meet up near the Central Plaza fountain.
GOTO plaza|10
NPC kushida|Ayanokouji-kun! Karaoke after class! You're coming! No excuses allowed!
CHOICE Karaoke with the class?|Accept happily|Plead poverty|Maybe next time
RESPONSE 0|kushida|Yes! Victory! Okay everyone, Ayanokouji-kun is officially in!
RESPONSE 1|kushida|Boo! Then I'm charging you one hangout as debt. Interest compounds daily!
RESPONSE 2|kushida|Next time means this time! Locked in!
IF kushida_contact JUMP ch5_kushida_warm
LABEL ch5_kushida_cold
NARR Kushida's smile, when it landed on me, kept a polite half-step of distance. We had never traded contacts, and she remembered.
NARR Invisible by choice. Occasionally useful.
JUMP ch5_after_kushida
LABEL ch5_kushida_warm
NPC kushida|Ayanokouji-kun! I still have your contact from day one, you know? The class group chat is missing exactly one person!
ME ...Fine. Add me.
NPC kushida|Yesss! Welcome to the loudest group chat in Class D! Horikita-san, he said yes before you could say no!
NPC horikita|I was never asked.
LABEL ch5_after_kushida
NARR That evening, everything changed. Sudou stayed late behind the special building... and three Class C students found him.
NARR Words became shoves, shoves became fists. By nightfall Sudou was summoned for a formal hearing. Expulsion was on the table.
TIME 18:00
OBJ Find Horikita at the plaza.
CMD horikita|plaza
GOTO plaza|10
NPC horikita|Chabashira-sensei asked me to save Sudou. Witnesses who saw the provocation would clear him.
NPC horikita|But gathering classmates requires... connections. Something I neither want nor possess.
ME So the ice queen needs a favor. From me, of all people.
NPC horikita|Do not enjoy this. Will you help or not?
CHOICE Help save Sudou?|Fine. I'm in|Refuse flatly|Negotiate a price
RESPONSE 0|horikita|Good. Tomorrow morning, the plaza. Bring nothing but your face.
RESPONSE 1|horikita|Refuse, and you lose nothing. Except perhaps the classmate who sits beside you every single day.
RESPONSE 1|me|...That was low. Fine. I'm in.
RESPONSE 2|horikita|Points? You would haggle over a classmate's future? ...Effective. Name it later. You're helping either way.

# ---------------------------------------------------------------- Chapter 6
CHAPTER 6|The End of Everyday Life
TITLE The following morning
TIME 07:50
OBJ Gather allies at the plaza.
CMD kushida|plaza
CMD hirata|plaza
GOTO plaza|10
NPC hirata|If Sudou is expelled, Class D loses its best athlete. And a friend. Count me in.
NPC kushida|Leave the Class C girls to me! Shinohara-san and Miyamoto-san saw everything. Those boys insulted Sudou-kun first and swung first too!
ME So it was provocation and self-defense. With testimony, the hearing flips.
NPC horikita|Precisely. Facts do not care about reputations. We present them coldly and win.
SET evidence_ready
NARR For the first time, our aimless Class D moved together toward a single point. It felt almost like having friends.

# ---------------------------------------------------------------- Chapter 7
CHAPTER 7|Classroom of the Elite
TITLE May 1 - deposits day
TIME 08:00
OBJ Homeroom. Points day.
GOTO classroom|14
NPC ike|Sensei! My points didn't arrive! I couldn't even buy juice this morning!
NPC chabashira|Points were wired on the first of the month. To every student. Without exception.
NPC chabashira|Are you truly unable to deduce what that means? Your behavior was evaluated. Late arrivals, idle chatter, sleeping in class.
NPC chabashira|Class points determine the monthly allowance. Class A currently holds 940 points. Class B, 650. Class C, 490. Class D... zero.
NARR Zero. Our 100,000-yen monthly paradise evaporated overnight because we behaved like fools. The room went ice-cold.
NPC chabashira|This school measures your worth. Complain to the mirror, not to me.
TELEPORT 0|1.4|30
TITLE Student Council Hearing - Special Building
SPAWN manabu|24|-53|180
OBJ Proceed to the Special Building entrance for Sudou's hearing.
GOTOAT 24|-53|7
NPC manabu|Testimonies from Class C students confirm verbal provocation and the first physical contact came from Class C.
NPC manabu|Self-defense does not merit expulsion. Sudou Ken remains in Class D under probationary observation.
NARR Beside the president stood his sister, Horikita Suzune, saying nothing. Family resemblance in faces, in frost, everywhere.
NPC sudou|Heh... told you I'd remember my own name. Thanks... I guess.
DESPAWN manabu
TELEPORT 0|1.4|30

# ---------------------------------------------------------------- Chapter 8
CHAPTER 8|The Association of Failures
TITLE A week later
TIME 13:00
OBJ Lunch at the cafeteria.
GOTO cafeteria|10
NPC hirata|Chabashira-sensei confirmed it: anyone who fails the midterm is expelled on the spot. Immediately.
NPC hirata|So I propose study groups. Studying together protects everyone, and better scores may raise our class points.
NPC ike|Studying?! In spring?! My brain wasn't built for voluntary suffering!
NPC yamauchi|Ike, we die if we fail! Priorities!
NPC horikita|Ayanokouji-kun. Assemble them. I will teach, since competence evidently must be imported.
ME You just volunteered yourself with zero hesitation.
NPC horikita|Someone here must be useful. Compass in hand, I will keep them awake.
NARR And so the Association of Failures was founded: three idiots, one tutor, and me.
CHOICE Commit to the study group?|Every evening, properly|Drift in when convenient
RESPONSE 0|me|Every evening. If we are doing this, we do it properly.|horikita_study
RESPONSE 1|me|I'll drift in and out. No promises.
TIME 17:30
OBJ Buy old exam sets at the convenience store.
GOTO store|9
NARR Through an upperclassman Kushida knew, we obtained printed copies of last year's midterm papers. Paid in points, fair and square.
NPC horikita|Purchasing old questions is not prohibited here. Resourcefulness counts. Memorize these patterns and the red line cannot touch you.
NPC sudou|Old tests...? So studying is just memorizing? Why didn't anyone say that sooner!

# ---------------------------------------------------------------- Chapter 9
CHAPTER 9|The Failures Mobilize Once Again
TITLE Study session day
TIME 16:00
OBJ Study session at the Memorial Library.
CMD sudou|library
CMD ike|library
CMD yamauchi|library
CMD kushida|library
GOTO library|10
NPC horikita|Page twelve. Solve them all before anyone leaves. Questions cost one honest attempt first.
NPC ike|Twelve pages?! My soul is leaving my body through my pencil!
NPC yamauchi|Hold my hand, bro... tell Yamauchi-chan I loved her...
NPC kushida|You two are hilarious! Okay, okay, focus! Horikita-san, this formula, please explain again?
NPC sudou|Tch. Move, Ike. If I'm doing this, I'm doing it properly. Basketball team captains need passing grades.
IF horikita_study JUMP ch9_committed
LABEL ch9_casual
NARR I drifted in and out of the sessions that week. Horikita counted every one of my absences out loud. Twice.
JUMP ch9_exam_eve
LABEL ch9_committed
NPC horikita|Every session attended. Noted. Do not make me praise you — we would both hate it.
ME Noted. Same.
LABEL ch9_exam_eve
NARR Day after day the library held our strange little alliance. Slowly, painfully, numbers began to stick.
NPC horikita|Tomorrow is the exam. Sleep early. Arrive late once more and I will personally end you.

# ---------------------------------------------------------------- Chapter 10
CHAPTER 10|Midterm Exam
TITLE Examination Day
TIME 09:00
OBJ Take your seat for the midterm.
GOTO classroom|14
NARR Papers flipped in unison. Fifty minutes. Five subjects compressed into one decisive morning.
NARR You flexed your mental muscles and worked through each problem in turn...
QUIZ
NARR Pens down. Whatever the outcome, Class D had finally taken something seriously together.

# ---------------------------------------------------------------- Chapter 11
CHAPTER 11|The Beginning
TITLE Results day
TIME 08:30
OBJ Hear the results in class.
GOTO classroom|14
NPC chabashira|Impressive. Perfect scores across mathematics, Japanese and social studies. More than ten of you.
NPC chabashira|And Sudou... sixty in four subjects. Thirty-nine in English. Above the red line. No expulsions today.
NPC sudou|YES!! Did you see?! Sixty!! I'm a genius!!
NPC ike|We showed you, sensei! When Class D really tries, we can do anything!
IF quiz_high JUMP ch11_aced
IF quiz_low JUMP ch11_scraped
NARR My own answer sheet was exactly as unremarkable as I intended it to be. Nobody looked twice.
JUMP ch11_chabashira
LABEL ch11_aced
NPC ike|And Ayanokouji-bro topped the whole class! Teach us your ways, master!
NARR A perfect sheet, quietly filed away. Being underestimated requires being unremarkable first. My classmates drew the opposite lesson. Fine.
JUMP ch11_chabashira
LABEL ch11_scraped
NPC yamauchi|Thirty-eight in English... bro, we LIVED. We actually LIVED!
NARR Barely over the red line, all of us. A pass was a pass. The Association holds.
LABEL ch11_chabashira
NPC chabashira|Indeed. However, one result interests me greatly. Ayanokouji.
NARR Every single subject: exactly fifty points. Not forty-nine, not fifty-one. Fifty. Precision that precise is never luck.
NPC chabashira|Fifty in every subject. Careful, deliberate mediocrity. Are you hiding something, Ayanokouji?
CHOICE Respond how?|I just studied evenly|Say nothing|Smile mysteriously
RESPONSE 0|chabashira|Evenly? Nobody studies evenly. Enjoy your anonymity while it lasts.
RESPONSE 1|chabashira|Silence. Of course. The interesting ones never explain themselves.
RESPONSE 2|chabashira|Save the theatrics. I will be watching your scores, Ayanokouji.
NPC horikita|Exactly fifty in everything... Ayanokouji-kun. What exactly are you?
ME Just a failure of Class D. Isn't that what you call me?
NPC horikita|Hmph. Failures do not survive Chabashira-sensei's attention span. I will uncover you eventually.
NARR Hidden talent, hidden past, hidden purpose. My three years at this school had only just begun.
TITLE The Beginning

# ---------------------------------------------------------------- Chapter 12
CHAPTER 12|Victory Celebration
TITLE That evening - Keyaki Mall Karaoke
TIME 19:00
OBJ Join the celebration at Keyaki Mall.
CMD ike|mall
CMD yamauchi|mall
CMD hirata|mall
CMD kushida|mall
CMD karuizawa|mall
CMD horikita|mall
GOTO mall|10
NPC ike|Karaoke time! Winner gets a free drink courtesy of Sudou's probation wallet!
NPC yamauchi|Bro, your wallet is emptier than our class point account!
NPC kushida|Everyone, duet with me! Horikita-san, you too! No escaping!
NPC horikita|Absolutely not. I am here solely because refusal proved statistically futile.
NPC hirata|Ha! She's singing. Everyone pretend to be very surprised.
NPC karuizawa|Kikyou, pick a song we know! Hirata-kun, you're on backup vocals!
CHOICE Grab the mic?|Sing your heart out|Guard the drinks table|Duet with Kushida
RESPONSE 0|narr|You sang. Terribly, gloriously, at full volume. Nobody remembered the score by the end. That was the point.
RESPONSE 1|narr|You guarded refreshments all night. Strategic retreat is also a skill. Kushida dragged you up for the chorus anyway.
RESPONSE 2|narr|Kushida harmonized, you mumbled, the room roared anyway. For one evening, Class D sounded undefeated.
NARR Laughter spilled out of the karaoke box into the neon-lit night. A class of failures, celebrating survival like champions.
NARR Somewhere between those walls, without ever announcing it, we had become classmates worth keeping.
NARR And deep below the surface, quietly waiting, something inside me had finally begun to move.
END
