# Callnote

Callnote is a standalone prototype for following an earnings call while its transcript moves with the audio. It is now preloaded with the latest call recordings and official transcript PDFs found for Yash Highvoltage and SG Finserve.

## Open it

Open `index.html` in a recent browser. Select either company in the call list, press Play, and click a transcript line to seek the recording. Use **Transcript PDF** for the original company transcript and **Official source** to open the company investor page.

Use **Add a call** to load a local audio file and paste a transcript. You can also use the library to switch between calls added during the current browser session.

## Transcript formats

The most accurate sync comes from JSON segments with start and end times in seconds. The app also accepts `MM:SS | Speaker | words` lines. Clicking a transcript line seeks the audio to that line. Add per-word start and end times for word-level highlighting; line timestamps highlight the active sentence.

The company PDFs provide transcript text but no audio timestamps. I aligned spoken words to each recording with local speech recognition timestamps while keeping the PDF wording intact. When recognized speech differs from the PDF, the app interpolates timing between nearby matched words. The player labels these calls **WORD SYNC** and shows the share of timings that were interpolated: 15.4% for Yash Highvoltage and 21.5% for SG Finserve.

See [callnote-transcript-template.json](callnote-transcript-template.json) for the expected JSON shape. A plain, untimed transcript is accepted too, but the app estimates its line timing from reading speed and labels it as estimated.

The included recordings and transcript PDFs are local files under `calls/`, so they remain available after refresh. Calls you import manually are held in memory and are cleared when the page is closed or refreshed. No server or account is included.

## Included calls

- Yash Highvoltage Limited — H1 FY27 earnings call, 21 October 2026. Official investor page: [yashhv.com](https://www.yashhv.com/investor-portal/investor-presentation-press-notes-and-newspaper-publication).
- SG Finserve Limited — Q2 and H1 FY27 earnings call, 16 October 2026. Official investor page: [sgfinserve.com](https://www.sgfinserve.com/schedule-analyst).

Original audio and PDFs are in [calls/](calls/). The browser loads the local audio files and pre-extracted transcript lines from `calls/calls-data.js`.

## What a production version needs

The player and transcript interaction are the front end. To serve calls across Indian listed companies, a production build also needs an authorized source for call audio and transcripts, a backend that stores company and event metadata, durable audio and transcript storage, and an alignment step that adds timestamps to corrected transcript text. A provider may return word timestamps directly; otherwise, a forced aligner can align transcript text to the audio. The website can then load those timed segments by company and quarter.

The hard part is reliable, permitted call data and transcript-to-audio alignment. This prototype lets you evaluate the listening experience and import format before choosing those providers. Its current word alignment is recognition-based; a production version should review the alignment and use a forced aligner against corrected transcript text when tighter timing is needed.
