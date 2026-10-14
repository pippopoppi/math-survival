# Math Survival 🧮

Gioco di calcolo mentale a tempo per browser, gratis e senza installare nulla.
**Gioca:** https://pippopoppi.github.io/math-survival/

*Solve. Survive. Beat your best.*

Parti con **30 secondi**. Sullo schermo compare un'operazione (somma o sottrazione):
digita il risultato sul tastierino e premi SUBMIT. Ogni risposta giusta ti regala tempo,
ogni salto te lo toglie. Quando il cronometro arriva a zero la partita finisce e il
punteggio è il numero di operazioni risolte. Una partita, un punteggio, ancora una.

## Regole

| Azione | Effetto |
| --- | --- |
| Risposta corretta | +1 punto, **+2 s**, nuova operazione |
| 5 corrette di fila | **+10 s** extra (oltre ai +2 s), i 5 pallini si illuminano e si azzerano |
| Risposta sbagliata | ✗ rossa, serie azzerata, stessa operazione, nessuna perdita di tempo |
| SKIP | **−5 s**, serie azzerata, nuova operazione. Con meno di 5 s il salto chiude la partita |

La difficoltà cresce con il punteggio, senza livelli visibili: da `8 + 7` fino a `578 + 674`,
con qualche operazione più facile mescolata nelle fasi avanzate. Il record personale si
salva sul dispositivo (`localStorage`).

## Comandi

| Azione | Touch | Tastiera |
| --- | --- | --- |
| Cifre | tastierino | `0`–`9` (anche tastierino numerico) |
| Cancella | ⌫ (tieni premuto per svuotare) | `Backspace`, `Esc` svuota |
| Invia | SUBMIT | `Enter` |
| Salta | SKIP | nessun tasto, di proposito |
| Audio | 🔊 in alto / in basso a sinistra | — |

Suoni sintetizzati con Web Audio (nessun file audio), sbloccati al primo tocco anche su
iOS Safari. Rispetta `prefers-reduced-motion`. Se cambi scheda o metti il browser in
background il cronometro si ferma e riparte da dove era.

## Condividi

A fine partita il pulsante SHARE usa la Web Share API (iOS/Android); dove non è disponibile
copia negli appunti *"I scored 37 in Math Survival! Can you beat me?"* con il link al gioco,
ricavato dall'URL corrente (nessun indirizzo scritto a mano nel codice).

## Struttura

```text
index.html   markup delle tre schermate (start, gioco, game over)
style.css    layout mobile-first, safe area, 100dvh, dark text su fondo chiaro
game.js      CONFIG + DIFFICULTY in testa; core puro (generazione, timer, punteggio) + livello DOM
tools/       publish.sh (commit + push), make_og.py (og.png e icon-180.png con Pillow)
```

Tutti i parametri di gioco sono nell'oggetto `CONFIG` e nella tabella `DIFFICULTY` all'inizio
di `game.js`. Il core è esposto su `window.MathSurvival` e funziona anche sotto Node per
le simulazioni.

## Deploy su GitHub Pages

1. Crea un repository su GitHub.
2. Carica `index.html`, `style.css` e `game.js` (e il resto della cartella) nella root.
3. Apri *Settings → Pages*.
4. Scegli *Deploy from a branch*.
5. Seleziona `main` e `/ (root)`.
6. Apri `https://USERNAME.github.io/REPOSITORY/`.

Nessuna build, nessuna variabile d'ambiente, nessun server: solo file statici.

## Licenza

MIT — Pippo Poppi Games.
