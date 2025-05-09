import { initializeNavigation } from "./navigation-service.js";
import { initializeSpeech } from "./speech-service.js";
import { initializeElementHandling } from "./element-service.js";
import { initializeCapture } from "./capture-service.js";
import { initializeSimplify } from "./simplify-service.js";
import { initializeModes } from "./mode-service.js";
import { initializeMessaging } from "./messaging-service.js";

console.log("Screen Reader Extension: Content script loaded on this page!");

initializeNavigation();
initializeSpeech();
initializeElementHandling();
initializeCapture();
initializeSimplify();
initializeModes();
initializeMessaging();
