// ===== AI Evening Plan Generator (Gemini free tier) =====
// Get free API key at: https://aistudio.google.com/apikey (no credit card)

async function generateEveningPlan(venues, events, location, types) {
  const apiKey = localStorage.getItem('gemini_key');
  if (!apiKey) {
    return { text: '🔑 Per attivare il pianificatore AI, vai su https://aistudio.google.com/apikey (gratis, no carta) e incolla qui la chiave:', needsKey: true };
  }

  const typeNames = { nightclub:'discoteche', bar:'bar', pub:'pub', cinema:'cinema', theatre:'teatri', restaurant:'ristoranti', live_music:'musica dal vivo', events_venue:'eventi' };
  const typeLabel = types.map(t => typeNames[t] || t).join(', ');

  const venueList = venues.slice(0, 15).map(v =>
    `- ${v.name} (${v.label}, ${v.address}${v.rating ? ', valutazione ' + v.rating : ''})`
  ).join('\n');

  const eventList = events.slice(0, 10).map(e =>
    `- ${e.name} al ${e.venue} il ${e.date}${e.priceMin ? ', da ' + e.priceMin + '€' : ''}`
  ).join('\n');

  const prompt = `Sei un esperto di vita notturna italiana. Basandoti sui seguenti locali ed eventi vicino a ${location}, suggerisci un programma per stasera in 2-3 tappe (aperitivo, cena, dopo cena/serata). Scrivi in italiano, tono entusiasta e informale. Massimo 250 parole. NON usare markdown, solo testo semplice con emoji.

Preferenze: ${typeLabel}

LOCALI VICINI:
${venueList || '(nessun locale trovato)'}

EVENTI IN ZONA:
${eventList || '(nessun evento trovato)'}

Il programma:`;

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (resp.status === 400) throw new Error('API key non valida');
      if (resp.status === 429) throw new Error('Hai raggiunto il limite gratuito (riprova tra un minuto)');
      throw new Error(err.error?.message || 'Errore API');
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Nessun suggerimento generato.';
    return { text, needsKey: false };
  } catch (err) {
    return { text: 'Errore: ' + err.message, needsKey: false };
  }
}
