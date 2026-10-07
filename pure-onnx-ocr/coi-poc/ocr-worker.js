// A dedicated worker must live inside the service worker's scope: its script
// response only gets the COEP header (required in a cross-origin isolated
// page) when this directory's service worker serves it. Same-origin modules it
// imports from elsewhere are fine.
import "../v0.3.0/worker.js";
