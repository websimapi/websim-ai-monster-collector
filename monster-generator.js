// import { rootWords } from "./root-words.js";
const rootWords = window.rootWords;

function getRandomElements(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function getRootWordPrompt() {
    const allPrefixes = [...rootWords.greek.prefixes, ...rootWords.latin.prefixes];
    const allSuffixes = [...rootWords.greek.suffixes, ...rootWords.latin.suffixes];

    const selectedPrefixes = getRandomElements(allPrefixes, 5);
    const selectedSuffixes = getRandomElements(allSuffixes, 5);

    let prompt = "Here are some Greek and Latin root words and their meanings to inspire you:\n\nPrefixes:\n";
    selectedPrefixes.forEach(p => {
        prompt += `- ${p.word}: ${p.meaning}\n`;
    });
    prompt += "\nSuffixes:\n";
    selectedSuffixes.forEach(s => {
        prompt += `- ${s.word}: ${s.meaning}\n`;
    });
    return prompt;
}

// Step 1: Generate monster name, scare level, and details
async function generateMonsterConcept(existingNames) {
    const rootWordPrompt = getRootWordPrompt();
    const systemPrompt = `You are a creative mythologist designing a new, unique monster for a collectible card game.
Combine Greek and Latin root words to invent a compelling monster name.
Your response must be a single JSON object with no other text.
The JSON object must follow this schema:
{
  "name": "string", // A unique, creative monster name.
  "scare_level": "string", // e.g., 'Mischievous', 'Unsettling', 'Terrifying', 'Apocalyptic'
  "details": "string" // A 1-2 sentence description of the monster's lore, habitat, or abilities.
}

${rootWordPrompt}

The monster name must be unique and not in this list of existing names: [${existingNames.join(', ')}].`;

    const completion = await websim.chat.completions.create({
        messages: [{
            role: "system",
            content: systemPrompt,
        }, ],
        json: true,
    });

    return JSON.parse(completion.content);
}

// Step 2: Generate a visual description for the image AI
async function generateVisualDescription(monsterConcept) {
    const systemPrompt = `You are an art director describing a monster for an artist to paint.
Based on the monster's name, scare level, and details, create a vivid and detailed visual description.
Focus on the physical appearance, texture, colors, environment, and mood.
This description will be used as a prompt for an image generation AI.
Respond with only the description text, and nothing else.`;

    const userPrompt = `Monster Name: ${monsterConcept.name}\nScare Level: ${monsterConcept.scare_level}\nDetails: ${monsterConcept.details}`;

    const completion = await websim.chat.completions.create({
        messages: [{
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: userPrompt,
            },
        ],
    });

    return completion.content;
}

// Step 3: Generate the monster image
async function generateMonsterImage(visualDescription) {
    const imagePrompt = `Fantasy monster card art, ${visualDescription}. Epic, detailed, atmospheric, high-quality digital painting.`;

    const result = await websim.imageGen({
        prompt: imagePrompt,
        aspect_ratio: "2:3",
    });

    return result.url;
}

async function generateNewMonster(existingNames, setStatus) {
    try {
        setStatus("Forging a new legend...");
        const monsterConcept = await generateMonsterConcept(existingNames);

        setStatus("Visualizing the beast...");
        const visualDescription = await generateVisualDescription(monsterConcept);

        setStatus("Painting the nightmare...");
        const imageUrl = await generateMonsterImage(visualDescription);

        return {
            ...monsterConcept,
            imageUrl,
            id: self.crypto.randomUUID(),
            timestamp: new Date().toISOString(),
        };

    } catch (error) {
        console.error("Error generating monster:", error);
        throw new Error("The ritual failed. The monster escaped into the aether.");
    }
}

window.generateNewMonster = generateNewMonster;