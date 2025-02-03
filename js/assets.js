import { AssetManager } from './canvas-lord/canvas-lord.js';

export const ASSETS = {
	MRCLEAN_PNG: 'mr_clean.png',
	BADGUY_PNG: 'badguy.png',
	BG_PNG: 'bg.png',
	BG2_PNG: 'bg2.png',
	BUBBLES2_PNG: 'bubbles2.png',
	FLOOR_PNG: 'floor.png',
	FLOOR_GRADIENT_PNG: 'floor_gradient.png',
	GRIMEBOSS_PNG: 'grimeboss.png',

	// backgrounds
	BG_SUNSET: 'bg_0_sunset.png', // static
	BG_CLOUD: 'bg_1_clouds.png', // static
	BG_PYRAMIDS: 'pyramids.png', // parallax
	BG_SKYSCRAPERS: 'parallax_parts_skyscrapers.png', // parallax
	BG_FG: 'parallax_parts_fg.png', // tiled

	// menu
	LOGO: 'logo.png',

	// audio
	THUD: 'thud.wav',
	THUNK: 'thunk.wav',
	WHACK: 'whack.wav',
	CRUNCH: 'crunch.wav',

	ACH: 'ach.wav',
	OW: 'ow.wav',
	UGH: 'ugh.wav',
	WUGH: 'wugh.wav',

	POP: 'pop.wav',
};

export const DEPTH = {
	BACKGROUND: 1000,
	SKYSCRAPERS: 100,
	TILES: 10,
	BUILDINGS: 9,
	OVERLAY: -1000,
	CAMERA: -Infinity,
};

export const COLLISION_TAG = {
	BUBBLE: 'BUBBLE',
	CHAR: 'CHAR',
	HITBOX: 'HITBOX',
};

export const punch_sfx = [
	ASSETS.THUD,
	ASSETS.THUNK,
	ASSETS.WHACK,
	ASSETS.ACH,
	ASSETS.OW,
	ASSETS.UGH,
	ASSETS.WUGH,
];

export const defaultSettings = {
	autoLevel: false,
	showCamera: false,
	showHitboxes: false,
	invincible: false,
	hideOverlay: false,
	seed: undefined,
	playerSpeed: 1,
	cameraInner: 40,
	cameraOuter: 132,
	cameraSpeed: 10,
	enemyHealth: 6,
};
let localStorageSettings = {};
if (window.debugEnabled) {
	localStorageSettings = JSON.parse(localStorage.getItem('settings')) ?? {};
}
export const settings = Object.assign({}, defaultSettings, localStorageSettings);

// delete old keys
Object.keys(settings).forEach((key) => {
	if (!(key in defaultSettings)) {
		delete settings[key];
	}
});


export const assetManager = new AssetManager('./img/');