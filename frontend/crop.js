import sharp from 'sharp';
import fs from 'fs';

async function processImage() {
  const input = '../images/AC-LOGO.png';
  const output = 'electron/AC-LOGO.png';

  try {
    await sharp(input)
      .trim()
      .toFile(output);
    console.log("Successfully trimmed the image and saved to electron/AC-LOGO.png");
    
    fs.copyFileSync(output, input);
    console.log("Copied back to images/AC-LOGO.png");
  } catch (error) {
    console.error("Error processing image:", error);
  }
}

processImage();
