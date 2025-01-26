import { Scene, Entity } from './canvas-lord/canvas-lord.js';
import { Draw } from './canvas-lord/util/draw.js';
import { Vec2 } from './canvas-lord/util/math.js';
import { Sprite, Text, GraphicList } from './canvas-lord/util/graphic.js';

const names = [
	'Bret Hudson',
	'Colin Davidson',
	'Will-iam Bundy',
	'Yasser Arguelles Snape',
];

const roles = [
	// Bret
	'Engine + Tools',
	// Colin
	'Sound + Production',
	// Will
	'Art + Design',
	// Yasser
	'Gameplay Programming',
];

const bullet = '/';

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

const leading = 24;

class MenuCredit extends Entity {
	t = 0;
	count = 0;

	constructor(x, y, name, roleText, index) {
		super(x, 0);

		this.startX = x;

		this.index = index + 0.5;

		this.graphic = new GraphicList();

		this.name = name.replace('-', '');
		this.short = name.split(' ')[0].split('-')[0];
		const text = new Text(this.name, 0, y);
		text.count = this.short.length;
		text.font = 'Skullboy';
		text.size = 32;
		text.align = 'center';
		this.text = text;
		this.graphic.add(text);

		const role = new Text(roleText, 0, y - 18);
		role.font = 'SkullBoy';
		role.align = 'center';
		role.size = 18;
		role.color = '#bbc';
		role.alpha = 0;
		this.role = role;
		this.graphic.add(role);

		// centerOrigin() sets the width/height
		// text.centerOrigin();
		// text.offsetX = text.offsetY = 0;
		text.height = 14;
		text.offsetY = -7;
	}

	setTime(t) {
		this.t = t;

		this.visible = t > 0;

		const { width } = this.scene.engine.canvas;
		this.x = Math.lerp(this.startX, width >> 1, t);

		this.y = Math.lerp(0, this.index * leading * 2, t);
		this.text.height = 14;
		this.text.offsetY = -7;

		this.expand = t >= 1;
	}

	inc = 0;

	update() {
		const alphaDelta = 0.05;

		if (this.expand) {
			if (this.inc > 3) {
				++this.text.count;
				this.inc -= 3;
			}
			this.role.alpha += alphaDelta;
		} else {
			--this.text.count;
			this.role.alpha -= alphaDelta;
		}

		this.role.alpha = Math.clamp(this.role.alpha, 0, 1);

		this.text.count = Math.clamp(
			this.text.count,
			this.short.length,
			this.text.str.length,
		);

		this.inc += 1.5;
	}
}

export class Menu extends Scene {
	inc = 0;

	optionSelected = 0;

	creditsOpen = false;
	creditsTimer = 0;
	creditsDuration = 60;
	targetCameraY = -300;

	constructor(engine, Level) {
		super(engine);

		const creditX = [132, 200, 261, 335];
		const creditY = engine.canvas.height - 20;
		this.credits = names.map((name, i) => {
			const x = creditX[i];
			const entity = new MenuCredit(x, creditY, name, roles[i], 3 - i);
			this.addEntity(entity);
			this.addRenderable(entity);
			entity.setTime(0);
			return entity;
		});

		{
			// this.creditsOpen = true;
			// this.creditsTimer = this.creditsDuration;
		}

		this.Level = Level;

		const { assetManager } = engine;

		const canvasCenterX = engine.canvas.width >> 1;
		const canvasCenterY = engine.canvas.height >> 1;

		const logoSprite = new Sprite(assetManager.sprites.get(ASSETS.LOGO));
		const logoDim = [canvasCenterX, (logoSprite.height >> 1) + 20];
		const logo = this.addGraphic(logoSprite, ...logoDim);
		logo.graphic.centerOO();

		const menuOptions = [
			{
				str: 'Start Game',
				callback: () => this.goToLevel(),
			},
			{
				str: 'Credits',
				callback: () => this.goToCredits(),
			},
		];

		let startY = canvasCenterY;
		startY -= ((menuOptions.length - 1) * leading) / 2;
		this.menuOptions = [...menuOptions].map(({ str }, i) => {
			return {
				...menuOptions[i],
				entity: this.addText(
					str,
					canvasCenterX,
					startY + i * leading,
					32,
				),
			};
		});

		this.cursors = ['>', '<'].map((str, i) => {
			const offset = (i * 2 - 1) * 30;
			const entity = this.addText(str, canvasCenterX, 50, 32);
			entity.graphic.x = offset;
			return entity;
		});
		this.updateSelection();

		// TODO: Fonts by

		this.addText(
			'A Game By',
			canvasCenterX,
			engine.canvas.height - 20 - 12,
			12,
		);

		const creditsStr = names
			.map((name) => name.split(' ')[0].split('-')[0])
			.join(` ${bullet} `);
		this.tempCredits = this.addText(
			creditsStr,
			canvasCenterX,
			engine.canvas.height - 20,
			32,
		);
	}

	goToLevel() {
		const Level = this.Level;
		this.engine.pushScene(new Level(this.engine));
	}

	goToCredits() {
		this.creditsOpen = true;
	}

	updateSelection(dirY = 0) {
		const optionCount = this.menuOptions.length;
		this.optionSelected += dirY;
		this.optionSelected = (this.optionSelected + optionCount) % optionCount;

		for (let i = 0; i < optionCount; ++i) {
			this.menuOptions[i].entity.graphic.color =
				i === this.optionSelected ? '#fff' : '#bbc';
		}

		const menuOption = this.menuOptions[this.optionSelected].entity;

		let x = menuOption.graphic.width / 2 + 10;
		if (Math.floor(this.inc / 30) % 2 === 0) {
			x += 4;
		}
		const y = menuOption.y - 2;
		this.cursors.forEach((cursor) => {
			cursor.y = y;
			cursor.graphic.x = x * Math.sign(cursor.graphic.x);
		});
	}

	update(input) {
		super.update(input);

		if (this.creditsOpen) {
			this.updateSelection();

			if (input.keyPressed('Escape', 'Enter', ' ', 'Return')) {
				this.creditsOpen = false;
			}
		} else {
			const dirY =
				+input.keyPressed('ArrowDown') - +input.keyPressed('ArrowUp');

			this.updateSelection(dirY);

			const menuOption = this.menuOptions[this.optionSelected];

			const continueKeys = [' ', 'Enter', 'Return', 'z', 'Z', 'x', 'X'];
			if (input.keyPressed(continueKeys)) {
				menuOption.callback();
			}
		}

		this.creditsTimer += this.creditsOpen ? 1 : -1;
		this.creditsTimer = Math.clamp(
			this.creditsTimer,
			0,
			this.creditsDuration,
		);

		function easeInOutQuad(x) {
			return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
		}
		const ease = easeInOutQuad;

		const t = this.creditsTimer / this.creditsDuration;
		this.camera.y = Math.lerp(ease(t), 0, this.targetCameraY);

		this.tempCredits.visible = t <= 0;

		this.credits.forEach((credit) => {
			credit.setTime(t);
		});

		++this.inc;
	}

	addText(str, x, y, size) {
		const text = new Text(str);
		text.font = 'Skullboy';
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
