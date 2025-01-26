import {
	AssetManager,
	Game,
	Scene,
	Entity,
	Draw,
} from './canvas-lord/canvas-lord.js';
import { Vec2 } from './canvas-lord/util/math.js';
import { Random } from './canvas-lord/util/random.js';
import {
	Sprite,
	AnimatedSprite,
	GraphicList,
	Text,
} from './canvas-lord/util/graphic.js';

const ASSETS = {
	LOGO: 'logo.png',
};

const names = [
	'Bret Hudson',
	'Colin Davidson',
	'William Bundy',
	'Yasser Arguelles Snape',
];

// Fonts by Chequered Ink

const bullet = '•';

class Menu extends Scene {
	inc = 0;

	constructor(engine) {
		super(engine);

		const canvasCenterX = engine.canvas.width >> 1;

		const logoSprite = new Sprite(assetManager.sprites.get(ASSETS.LOGO));
		const logoDim = [canvasCenterX, logoSprite.height >> 1];
		const logo = this.addGraphic(logoSprite, ...logoDim);
		logo.graphic.centerOO();

		const startStr = 'Start Game';
		this.addText(startStr, canvasCenterX, 100, 12);

		const arrowStr = '> ' + ' '.repeat(startStr.length) + ' <';
		const arrows = this.addText(arrowStr, canvasCenterX, 100, 12);
		arrows.graphic.color = '#ccc';
		this.arrows = arrows;

		this.addText('A Game By', canvasCenterX, engine.canvas.height - 22, 9);
		const creditsStr = names
			.map((name) => name.split(' ')[0])
			.join(` ${bullet} `);
		this.addText(creditsStr, canvasCenterX, engine.canvas.height - 10, 9);
	}

	update() {
		this.arrows.visible = Math.floor(this.inc / 30) % 2 === 0;

		++this.inc;
	}

	addText(str, x, y, size) {
		const text = new Text(str);
		text.font = 'monospace';
		text.size = size;
		const entity = this.addGraphic(text, x, y);
		entity.graphic.centerOO();
		return entity;
	}

	addGraphic(graphic, x, y) {
		const entity = new Entity(x, y);
		entity.graphic = graphic;
		this.addEntity(entity);
		this.addRenderable(entity);
		return entity;
	}
}

let game;
const assetManager = new AssetManager('./img/');
Object.values(ASSETS).forEach((asset) => {
	switch (true) {
		case asset.endsWith('.png'):
			assetManager.addImage(asset);
			break;
		case asset.endsWith('.mp3'):
			assetManager.addAudio(asset);
			break;
	}
});
assetManager.onLoad(() => {
	if (game) return;

	game = new Game('ggj-2025-game', {
		fps: 60,
		gameLoopSettings: {
			updateMode: 'always', // or set it to 'focus'
			renderMode: 'onUpdate',
		},
	});
	game.assetManager = assetManager;
	game.backgroundColor = '#101010';

	const scene = new Menu(game);
	game.pushScene(scene);
	game.render();
});
assetManager.loadAssets();
