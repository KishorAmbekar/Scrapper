const express = require('express');
const puppeteer = require('puppeteer');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const app = express();
app.use(express.json());

app.post('/extract-intent', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let browser = null;
    try {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
        });
        
        const page = await browser.newPage();
        
        // Set a standard monitor size so the QR code renders cleanly
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Wait until the page and all visual canvas elements are fully loaded
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
        
        // Give their JavaScript an extra 2 seconds to finish animating/drawing the QR code
        await new Promise(r => setTimeout(r, 2000));
        
        // Take a screenshot of the page
        const screenshotBuffer = await page.screenshot({ type: 'png' });
        
        // Parse the image pixels
        const png = PNG.sync.read(screenshotBuffer);
        
        // Optically scan the image for a QR code
        const code = jsQR(png.data, png.width, png.height);
        
        if (code && code.data && code.data.includes('upi://')) {
            console.log("✅ Successfully scanned visually:", code.data);
            res.json({ success: true, intent: code.data });
        } else {
            // Fallback: If visual scan fails, try regex one last time just in case
            const content = await page.content();
            const match = content.match(/(upi:\/\/pay\?[^"'\s<>]+)/i);
            
            if (match) {
                const decoded = match[1].replace(/&amp;/g, '&');
                res.json({ success: true, intent: decoded });
            } else {
                res.status(404).json({ success: false, error: 'QR Code could not be visually decoded or found in source.' });
            }
        }
    } catch (error) {
        console.error("Puppeteer crash:", error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Optical Scraper microservice running on port ${PORT}`));
