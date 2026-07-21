const fs = require('fs');

async function fetchTechnodomImage(query) {
  try {
    const response = await fetch(`https://api.technodom.kz/katalog/api/v1/products?search=${encodeURIComponent(query)}&limit=1`);
    const data = await response.json();
    if (data && data.payload && data.payload.length > 0) {
        const item = data.payload[0];
        if (item.images && item.images.length > 0) {
             return `https://api.technodom.kz/f3/api/v1/images/800/800/${item.images[0].uri}`;
        }
    }
    return null;
  } catch(e) {
    return null;
  }
}

async function fetchMechtaImage(query) {
    try {
        const response = await fetch(`https://www.mechta.kz/api/v1/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data && data.data && data.data.items && data.data.items.length > 0) {
            return data.data.items[0].photos[0];
        }
        return null;
    } catch(e) {
        return null;
    }
}

const products = [
    "Моноблок Acer Aspire 24",
    "Моноблок Lenovo ThinkCentre",
    "Моноблок Lenovo Yoga",
    "Моноблок HP",
    "Моноблок HP EliteOne",
    "Моноблок Lenovo IdeaCentre"
];

async function main() {
    for (let p of products) {
        let url = await fetchTechnodomImage(p);
        if (!url) url = await fetchMechtaImage(p);
        console.log(`${p}: ${url}`);
    }
}

main();
