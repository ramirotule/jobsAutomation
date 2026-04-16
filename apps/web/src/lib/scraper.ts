import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configurar stealth para evitar detección
puppeteer.use(StealthPlugin());

export async function scrapeLinkedInDescription(url: string): Promise<string | null> {
  console.log(`Iniciando descarga de descripción para: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();
    
    // Configurar un User-Agent realista
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Navegar con un tiempo de espera más razonable y sin esperar a que la red esté ociosa (porque LinkedIn tiene muchos trackers)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Esperar un poco por si hay modales de "Inicia sesión" que floten
    await new Promise(r => setTimeout(r, 2000));

    // Intentar cerrar modales de login si aparecen (común en guest mode)
    try {
      const dismissButton = await page.$('button[aria-label="Dismiss"]');
      if (dismissButton) await dismissButton.click();
    } catch (e) { /* ignore */ }

    // Intentar hacer clic en "Show more" para expandir el texto
    try {
      const showMoreSelectors = [
        'button.show-more-less-html__button--more',
        'button[aria-expanded="false"]',
        '.description__button'
      ];
      
      for (const selector of showMoreSelectors) {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          await new Promise(r => setTimeout(r, 500));
          break;
        }
      }
    } catch (e) { /* ignore */ }

    // Extraer el texto de la descripción
    const description = await page.evaluate(() => {
      const selectors = [
        '.description__text',
        '.show-more-less-html__markup',
        '.jobs-description__content',
        '.jobs-description-content__text',
        'article.jobs-description__container',
        '.jobs-box__html-content',
        '#job-details',
        '.job-view-layout'
      ];
      
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el && el.textContent && el.textContent.trim().length > 50) {
          return el.textContent.trim();
        }
      }

      // Fallback: Si no hay selectores específicos, buscar el contenedor más grande con mucho texto
      const possibleContainers = document.querySelectorAll('div, section, article');
      let bestContent = '';
      for (const el of possibleContainers) {
        const text = el.textContent?.trim() || '';
        if (text.length > bestContent.length) {
          bestContent = text;
        }
      }
      
      return bestContent.length > 100 ? bestContent : null;
    });

    return description;
  } catch (error) {
    console.error(`Error en scraping de LinkedIn:`, error);
    return null;
  } finally {
    await browser.close();
  }
}
