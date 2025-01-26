import { Scene, Entity } from './canvas-lord/canvas-lord.js';
import { Sprite, Text } from './canvas-lord/util/graphic.js';

const names = [
	'Bret Hudson',
	'Colin Davidson',
	'William Bundy',
	'Yasser Arguelles Snape',
];

const bullet = '•';

const ASSETS = {
	MOLE_SKETCH_PNG: 'mole-sketch.png',
	MOLE_SKETCH_NO_BG_PNG: 'mole-sketch-no-bg.png',
	MRCLEAN_PNG: 'mr_clean.png',
	BG_PNG: 'bg.png',
	BG2_PNG: 'bg2.png',
	FLOORS_PNG: 'floors.png',

	// menu
	LOGO: 'logo.png',
};

export class Menu extends Scene {
	inc = 0;

	constructor(engine, Level) {
		super(engine);

		this.Level = Level;

		const { assetManager } = engine;

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

		// TODO: Fonts by

		this.addText('A Game By', canvasCenterX, engine.canvas.height - 22, 9);
		const creditsStr = names
			.map((name) => name.split(' ')[0])
			.join(` ${bullet} `);
		this.addText(creditsStr, canvasCenterX, engine.canvas.height - 10, 9);
	}

	goToLevel() {
		const Level = this.Level;
		this.engine.pushScene(new Level(this.engine));
	}

	update(input) {
		super.update(input);
		this.arrows.visible = Math.floor(this.inc / 30) % 2 === 0;

		if (input.keyPressed(' ')) {
			this.goToLevel();
		}

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
