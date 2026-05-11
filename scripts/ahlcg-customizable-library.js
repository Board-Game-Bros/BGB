(function () {
  window.AHLCG_CUSTOMIZABLE_LIBRARY = {
    cards: {
        "alchemical distillation": {
            "displayName": "Alchemical Distillation",
            "groups": [
                {
                    "id": "mending_distillate",
                    "label": "Mending Distillate.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this option: \"- Heal 2 damage.\""
                },
                {
                    "id": "calming_distillate",
                    "label": "Calming Distillate.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this option: \"- Heal 2 horror.\""
                },
                {
                    "id": "enlightening_distillate",
                    "label": "Enlightening Distillate.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this option: \"- Place 1 charge or secret on an asset you control.\""
                },
                {
                    "id": "quickening_distillate",
                    "label": "Quickening Distillate.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this option: \"- Move up to 2 times.\""
                },
                {
                    "id": "refined",
                    "label": "Refined.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Alchemical Distillation enters play with 2 additional supplies on it."
                },
                {
                    "id": "empowered",
                    "label": "Empowered.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "When you initiate this skill test, you may increase its difficulty by 2. If you do, increase the value of the effect granted by each option by 1 for this test."
                },
                {
                    "id": "perfected",
                    "label": "Perfected.",
                    "boxes": 5,
                    "xpTotal": 5,
                    "text": "If you succeed by 2 or more, the chosen investigator may perform two different options instead of one."
                }
            ]
        },
        "custom modifications": {
            "displayName": "Custom Modifications",
            "groups": [
                {
                    "id": "notched_sight",
                    "label": "Notched Sight.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "If you perform an attack with attached asset against an enemy engaged with another investigator and fail, you deal no damage."
                },
                {
                    "id": "extended_stock",
                    "label": "Extended Stock.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "You get +2 [combat] while attacking with attached asset."
                },
                {
                    "id": "counterbalance",
                    "label": "Counterbalance.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "After you attach an [[Upgrade]] card other than Custom Modifications to attached asset, draw 1 card."
                },
                {
                    "id": "leather_grip",
                    "label": "Leather Grip.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Custom Modifications gets -1 cost and gains: \"Fast. Play only during your turn.\""
                },
                {
                    "id": "extended_magazine",
                    "label": "Extended Magazine.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "After ammo is spent from or placed on attached asset by another event, place 1 ammo on attached asset."
                },
                {
                    "id": "quicksilver_bullets",
                    "label": "Quicksilver Bullets.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "If you succeed by 3 or more while attacking with attached asset, this attack deals +1 damage."
                }
            ]
        },
        "damning testimony": {
            "displayName": "Damning Testimony",
            "groups": [
                {
                    "id": "search_warrant",
                    "label": "Search Warrant.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "While investigating using Damning Testimony, you may ignore any effect or keyword on the investigated location that would trigger."
                },
                {
                    "id": "fabricated_evidence",
                    "label": "Fabricated Evidence.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Damning Testimony enters play with 2 additional evidence on it."
                },
                {
                    "id": "blackmail",
                    "label": "Blackmail.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "You get +2 [intellect] while investigating using Damning Testimony."
                },
                {
                    "id": "extort",
                    "label": "Extort.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "When you successfully investigate using Damning Testimony, you may spend 1 evidence to automatically evade the chosen enemy."
                },
                {
                    "id": "surveil",
                    "label": "Surveil.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "You may use Damning Testimony's ability to investigate the chosen enemy's location instead of your location."
                },
                {
                    "id": "expose",
                    "label": "Expose.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "When you successfully investigate using Damning Testimony, you may spend X evidence to discard the chosen enemy if it is non-[[Elite]]. X is that enemy's remaining health."
                }
            ]
        },
        "empirical hypothesis": {
            "displayName": "Empirical Hypothesis",
            "groups": [
                {
                    "id": "pessimistic_outlook",
                    "label": "Pessimistic Outlook.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following criteria: \"you run out of cards in your hand.\""
                },
                {
                    "id": "trial_and_error",
                    "label": "Trial and Error.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following criteria: \"you are dealt damage or horror.\""
                },
                {
                    "id": "independent_variable",
                    "label": "Independent Variable.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following criteria: \"you discard a treachery or enemy from play.\""
                },
                {
                    "id": "field_research",
                    "label": "Field Research.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following criteria: \"you enter a location with 3 or more shroud.\""
                },
                {
                    "id": "peer_review",
                    "label": "Peer Review.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "The chosen criteria is met if any investigator at your location meets it, instead of only you. Other investigators at your location may trigger [fast] abilities on Empirical Hypothesis."
                },
                {
                    "id": "research_grant",
                    "label": "Research Grant.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Empirical Hypothesis gains: \"[fast] Spend 2 evidence: Reduce the cost of the next card you play by 3.\""
                },
                {
                    "id": "irrefutable_proof",
                    "label": "Irrefutable Proof.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Empirical Hypothesis gains: \"[fast] Spend 3 evidence: Discover 1 clue at your location.\""
                },
                {
                    "id": "alternative_hypothesis",
                    "label": "Alternative Hypothesis.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "After you exhaust Empirical Hypothesis, you may resolve its forced effect, choosing a criteria you have not chosen this round. Then, ready it."
                }
            ]
        },
        "friends in low places": {
            "displayName": "Friends in Low Places",
            "groups": [
                {
                    "id": "helpful",
                    "label": "Helpful.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "When you play Friends in Low Places, you may choose another investigator at your location to resolve its effects."
                },
                {
                    "id": "versatile",
                    "label": "Versatile.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Choose another [[Trait]]: _____. When you play Friends in Low Places, you may choose one of the looked-at cards with both chosen [[Traits]] to add to your hand without spending 1 resource."
                },
                {
                    "id": "bolstering",
                    "label": "Bolstering.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Each card added to your hand by Friends in Low Places gains a [wild] icon until the end of the phase."
                },
                {
                    "id": "clever",
                    "label": "Clever.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Instead of shuffling the remaining cards into your deck, you may place each of them on the top of your deck, in any order."
                },
                {
                    "id": "prompt",
                    "label": "Prompt.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Friends in Low Places gains fast and \"play during any [fast] window\"."
                },
                {
                    "id": "experienced",
                    "label": "Experienced.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Increase the number of cards looked at by 3."
                },
                {
                    "id": "swift",
                    "label": "Swift.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "You may play one of the cards added to your hand <i>(paying its cost)</i>."
                }
            ]
        },
        "grizzled": {
            "displayName": "Grizzled",
            "groups": [
                {
                    "id": "specialist",
                    "label": "Specialist.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Choose another trait: _____"
                },
                {
                    "id": "specialist",
                    "label": "Specialist.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Choose another trait: _____"
                },
                {
                    "id": "nemesis",
                    "label": "Nemesis.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "If this is a skill test on or against an enemy with a chosen trait and the test is successful, you may attach Grizzled to that enemy. Reduce the difficulty of tests on or against the attached enemy by 1."
                },
                {
                    "id": "mythos_hardened",
                    "label": "Mythos-Hardened.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "If this skill test is on a treachery with a chosen trait and the test is successful, you may add both Grizzled and that treachery to the victory display."
                },
                {
                    "id": "always_prepared",
                    "label": "Always Prepared.",
                    "boxes": 5,
                    "xpTotal": 5,
                    "text": "After you draw an encounter card with a chosen trait, return one copy of Grizzled from your discard pile to your hand. (Max once per round.)"
                }
            ]
        },
        "honed instinct": {
            "displayName": "Honed Instinct",
            "groups": [
                {
                    "id": "reflex_response",
                    "label": "Reflex Response.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following play condition: \"- You take damage or horror.\""
                },
                {
                    "id": "situational_awareness",
                    "label": "Situational Awareness.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following play condition: \"- A location enters play or is revealed.\""
                },
                {
                    "id": "killer_instinct",
                    "label": "Killer Instinct.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following play condition: \"- An enemy engages you.\""
                },
                {
                    "id": "gut_reaction",
                    "label": "Gut Reaction.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following play condition: \"- A treachery enters your threat area.\""
                },
                {
                    "id": "muscle_memory",
                    "label": "Muscle Memory.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the following play condition: \"- You play an asset.\""
                },
                {
                    "id": "sharpened_talent",
                    "label": "Sharpened Talent.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "During the action granted by Honed Instinct, you get +2 to each of your skills."
                },
                {
                    "id": "impulse_control",
                    "label": "Impulse Control.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "You may include up to three copies of Honed Instinct in your deck. Honed Instinct gets -1 cost."
                },
                {
                    "id": "force_of_habit",
                    "label": "Force of Habit.",
                    "boxes": 5,
                    "xpTotal": 5,
                    "text": "When you play Honed Instinct, you may take 2 actions instead of 1 (one at a time). Then, remove it from the game."
                }
            ]
        },
        "hunter s armor": {
            "displayName": "Hunter's Armor",
            "groups": [
                {
                    "id": "enchanted",
                    "label": "Enchanted.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Hunter's Armor gains the [[Relic]] trait and takes up an arcane slot instead of a body slot."
                },
                {
                    "id": "protective_runes",
                    "label": "Protective Runes.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hunter's Armor may be assigned damage and/or horror dealt to other investigators at your location."
                },
                {
                    "id": "durable",
                    "label": "Durable.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hunter's Armor gains +2 health."
                },
                {
                    "id": "hallowed",
                    "label": "Hallowed.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hunter's Armor gains +2 sanity."
                },
                {
                    "id": "lightweight",
                    "label": "Lightweight.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hunter's Armor gets -1 cost and playing it does not provoke attacks of opportunity."
                },
                {
                    "id": "hexdrinker",
                    "label": "Hexdrinker.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "After 1 or more damage or horror is assigned to Hunter's Armor from a treachery effect, you may exhaust it to draw 1 card."
                },
                {
                    "id": "armor_of_thorns",
                    "label": "Armor of Thorns.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "After 1 or more damage or horror is assigned to Hunter's Armor from an enemy attack, you may exhaust it to deal 1 damage to that enemy."
                }
            ]
        },
        "hyperphysical shotcaster theoretical device": {
            "displayName": "Hyperphysical Shotcaster: Theoretical Device",
            "groups": [
                {
                    "id": "railshooter",
                    "label": "Railshooter.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hyperphysical Shotcaster has this form: \"<i>Manifest</i> - <b>Fight.</b> Fight with any skill. This attack deals +1 damage.\""
                },
                {
                    "id": "telescanner",
                    "label": "Telescanner.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hyperphysical Shotcaster has this form: \"<i>Manifest</i> - <b>Investigate.</b> Investigate with any skill. If you succeed, discover a clue at any revealed location instead of your location.\""
                },
                {
                    "id": "translocator",
                    "label": "Translocator.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hyperphysical Shotcaster has this form: \"<i>Manifest</i> - <b>Evade.</b> Attempt to evade with any skill. Before or after this attempt, you may move an investigator or a non-[[Elite]] enemy at your location to a connecting location, or vice versa.\""
                },
                {
                    "id": "realitycollapser",
                    "label": "Realitycollapser.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hyperphysical Shotcaster has this form: \"<i>Manifest</i> - Test any skill (3). If you succeed, discard from play a non-weakness treachery that is not attached to an [[Elite]] enemy.\""
                },
                {
                    "id": "matterweaver",
                    "label": "Matterweaver.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Hyperphysical Shotcaster has this form: \"<i>Manifest</i> - Choose an asset in your hand and test any skill (X), where X is that asset's cost. If you succeed, play that asset at no cost.\""
                },
                {
                    "id": "aetheric_link",
                    "label": "Aetheric Link.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "Hyperphysical Shotcaster enters play with 2 additional aether."
                },
                {
                    "id": "empowered_configuration",
                    "label": "Empowered Configuration.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "While using a <i>Manifest</i> ability, you get +2 skill value."
                }
            ]
        },
        "living ink": {
            "displayName": "Living Ink",
            "groups": [
                {
                    "id": "shifting_ink",
                    "label": "Shifting Ink.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "You may play Living Ink under the control of another investigator at your location."
                },
                {
                    "id": "subtle_depiction",
                    "label": "Subtle Depiction.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "At the start of your turn, you may choose not to remove 1 charge from Living Ink and ignore its ability for the remainder of the round."
                },
                {
                    "id": "imbued_ink",
                    "label": "Imbued Ink.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Living Ink enters play with 2 additional charges and takes up an arcane slot instead of a body slot."
                },
                {
                    "id": "eldritch_ink",
                    "label": "Eldritch Ink.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Choose another skill."
                },
                {
                    "id": "eldritch_ink",
                    "label": "Eldritch Ink.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Choose another skill."
                },
                {
                    "id": "macabre_depiction",
                    "label": "Macabre Depiction.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Living Ink gains: \"[reaction] After you reveal a chaos token with a symbol, exhaust Living Ink: Place 1 charge on it.\""
                },
                {
                    "id": "vibrancy",
                    "label": "Vibrancy.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Living Ink grants an additional +1 to the chosen skills and -1 to each other skill."
                }
            ]
        },
        "makeshift trap": {
            "displayName": "Makeshift Trap",
            "groups": [
                {
                    "id": "improved_timer",
                    "label": "Improved Timer.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "When you play Makeshift Trap, you may increase or decrease its uses by 1."
                },
                {
                    "id": "tripwire",
                    "label": "Tripwire.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Only trigger Makeshift Trap's forced ability if there are 1 or more enemies at attached location."
                },
                {
                    "id": "simple",
                    "label": "Simple.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Makeshift Trap gains fast and \"play during any [fast] window.\""
                },
                {
                    "id": "poisonous",
                    "label": "Poisonous.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "When you remove 1 or more time from Makeshift Trap, deal 1 damage to an enemy at attached location."
                },
                {
                    "id": "remote_configuration",
                    "label": "Remote Configuration.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "When you play Makeshift Trap, you may attach it to a revealed connecting location."
                },
                {
                    "id": "net",
                    "label": "Net.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Non-[[Elite]] enemies at attached location cannot move or make attacks of opportunity."
                },
                {
                    "id": "explosive_device",
                    "label": "Explosive Device.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "When Makeshift Trap has no time and is discarded, deal 3 damage to each enemy and investigator at attached location."
                }
            ]
        },
        "pocket multi tool": {
            "displayName": "Pocket Multi Tool",
            "groups": [
                {
                    "id": "detachable",
                    "label": "Detachable.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Other investigators at your location may use the ability on Pocket Multi Tool."
                },
                {
                    "id": "pry_bar",
                    "label": "Pry Bar.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "You get an additional +1 skill value if this is during a skill test on a treachery."
                },
                {
                    "id": "sharpened_knife",
                    "label": "Sharpened Knife.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "You get an additional +1 skill value if this is during an attack."
                },
                {
                    "id": "signal_mirror",
                    "label": "Signal Mirror.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "You get an additional +1 skill value if this is during an evasion attempt."
                },
                {
                    "id": "magnifying_lens",
                    "label": "Magnifying Lens.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "You get an additional +1 skill value if this is during an investigation."
                },
                {
                    "id": "lucky_charm",
                    "label": "Lucky Charm.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "After you fail a skill test, ready Pocket Multi Tool."
                },
                {
                    "id": "spring_loaded",
                    "label": "Spring-Loaded.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "Pocket Multi Tool's ability is now a [reaction] ability with the trigger: \"When you would fail a skill test you are performing, exhaust Pocket Multi Tool...\""
                }
            ]
        },
        "power word": {
            "displayName": "Power Word",
            "groups": [
                {
                    "id": "betray",
                    "label": "Betray.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the command: \"- <i>'Betray.'</i> Deal 1 damage to any enemy at this enemy's location with an equal or lower fight value than this enemy.\""
                },
                {
                    "id": "mercy",
                    "label": "Mercy.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the command: \"- <i>'Mercy.'</i> An investigator at this enemy's location heals damage or horror equal to this enemy's respective damage/horror value.\""
                },
                {
                    "id": "confess",
                    "label": "Confess.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the command: \"- <i>'Confess.'</i> Discover 1 clue at this enemy's location if its health is equal to or higher than its location's shroud.\""
                },
                {
                    "id": "distract",
                    "label": "Distract.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add the command: \"- <i>'Distract.'</i> Automatically evade any enemy at this enemy's location with an equal or lower evade value than this enemy.\""
                },
                {
                    "id": "greater_control",
                    "label": "Greater Control.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Power Word gains \"[fast]: Return Power Word to your hand.\""
                },
                {
                    "id": "bonded",
                    "label": "Bonded.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "You may activate the parley ability on Power Word from up to one location away from the attached enemy."
                },
                {
                    "id": "tonguetwister",
                    "label": "Tonguetwister.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "When you parley with Power Word, you may give up to two different commands."
                },
                {
                    "id": "thrice_spoken",
                    "label": "Thrice Spoken.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "You may include three copies of Power Word in your deck. When you give a command using one copy, also give that command to each other enemy with one of your copies of Power Word attached."
                }
            ]
        },
        "runic axe": {
            "displayName": "Runic Axe",
            "groups": [
                {
                    "id": "heirloom",
                    "label": "Heirloom.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "This asset gets -1 cost and gains the [[Relic]] trait."
                },
                {
                    "id": "inscription_of_glory",
                    "label": "Inscription of Glory.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this inscription: \"- <i>Glory</i> - If this attack defeats an enemy, choose one: draw 1 card, heal 1 damage, or heal 1 horror.\""
                },
                {
                    "id": "inscription_of_the_elders",
                    "label": "Inscription of the Elders.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this inscription: \"- <i>Elders</i> - If this attack succeeds by an amount equal to or greater than your location's shroud, discover 1 clue at your location.\""
                },
                {
                    "id": "inscription_of_the_hunt",
                    "label": "Inscription of the Hunt.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this inscription: \"- <i>Hunt</i> - Immediately move to a connecting location or engage an enemy at your location.\""
                },
                {
                    "id": "inscription_of_fury",
                    "label": "Inscription of Fury.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this inscription: \"- <i>Fury</i> - If this attack is successful, in addition to its standard damage, deal 1 damage to each other enemy engaged with you.\""
                },
                {
                    "id": "ancient_power",
                    "label": "Ancient Power.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "You may imbue the same inscription up to three times."
                },
                {
                    "id": "saga",
                    "label": "Saga.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Replenish 2 of Runic Axe's charges at the start of each round, instead of only 1."
                },
                {
                    "id": "scriptweaver",
                    "label": "Scriptweaver.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "For every charge spent, you may imbue the axe with up to two different inscriptions."
                }
            ]
        },
        "summoned servitor": {
            "displayName": "Summoned Servitor",
            "groups": [
                {
                    "id": "armored_carapace",
                    "label": "Armored Carapace.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Summoned Servitor gains a health value of 3. It can be assigned damage dealt to any investigator at its location."
                },
                {
                    "id": "claws_that_catch",
                    "label": "Claws that Catch.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this action: \"- <b>Fight.</b> You fight any enemy at this location with a base [combat] of 4. Ignore the aloof and retaliate keywords for this attack.\""
                },
                {
                    "id": "jaws_that_snatch",
                    "label": "Jaws that Snatch.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this action: \"- <b>Evade.</b> You attempt to evade any enemy at this location with a base [agility] of 4. Ignore the alert keyword for this evasion attempt.\""
                },
                {
                    "id": "eyes_of_flame",
                    "label": "Eyes of Flame.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Add this action: \"- <b>Investigate.</b> You investigate this location with a base [intellect] of 4.\""
                },
                {
                    "id": "wings_of_night",
                    "label": "Wings of Night.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "After Summoned Servitor moves from your location to a connecting location, you may move to that location, as well."
                },
                {
                    "id": "dominance",
                    "label": "Dominance.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Summoned Servitor no longer takes up an (circle one): arcane / ally slot."
                },
                {
                    "id": "dreaming_call",
                    "label": "Dreaming Call.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "Instead of discarding another asset you control in order to play Summoned Servitor, you may return that asset to its owner's hand."
                },
                {
                    "id": "dmonic_influence",
                    "label": "Dæmonic Influence.",
                    "boxes": 5,
                    "xpTotal": 5,
                    "text": "Summoned Servitor can take 2 different actions instead of 1 during each of your turns."
                }
            ]
        },
        "the raven quill": {
            "displayName": "The Raven Quill",
            "groups": [
                {
                    "id": "living_quill",
                    "label": "Living Quill.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Using attached asset's [action] abilities does not provoke attacks of opportunity."
                },
                {
                    "id": "spectral_binding",
                    "label": "Spectral Binding.",
                    "boxes": 1,
                    "xpTotal": 1,
                    "text": "Attached asset does not take up any slots."
                },
                {
                    "id": "mystic_vane",
                    "label": "Mystic Vane.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "You get +2 skill value while performing skill tests on attached asset."
                },
                {
                    "id": "endless_inkwell",
                    "label": "Endless Inkwell.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "Name two more [[Tome]] or [[Spell]] assets:"
                },
                {
                    "id": "energy_sap",
                    "label": "Energy Sap.",
                    "boxes": 2,
                    "xpTotal": 2,
                    "text": "The Raven Quill gains: \"[fast] Exhaust The Raven Quill: Move 1 secret or charge from an asset you control to attached asset.\""
                },
                {
                    "id": "interwoven_ink",
                    "label": "Interwoven Ink.",
                    "boxes": 3,
                    "xpTotal": 3,
                    "text": "After you resolve an [action] ability on attached asset, you may exhaust The Raven Quill to ready another asset you control."
                },
                {
                    "id": "supernatural_record",
                    "label": "Supernatural Record.",
                    "boxes": 4,
                    "xpTotal": 4,
                    "text": "When you play The Raven Quill, instead of attaching it to a named asset you control, you may search your deck, discard pile, and hand for a copy of a named asset and play it <i>(paying its cost)</i>. Then, attach The Raven Quill to it."
                }
            ]
        }
    }
  };
})();
