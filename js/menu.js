import { Scene, Entity, Sfx } from './canvas-lord/canvas-lord.js';
import { Draw } from './canvas-lord/util/draw.js';
import { Vec2 } from './canvas-lord/util/math.js';
import {
	AnimatedSprite,
	Sprite,
	Text,
	GraphicList,
} from './canvas-lord/util/graphic.js';
import { ASSETS } from './assets.js';

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

const leading = 24;

function* yieldFor(frames) {
	while (frames--) yield;
}

const logoColor = '#91DAF7';
const logoDimmed = '#cd9cca';

const speed = 5;

function* walkTo(character, x, speed = 1) {
	console.log('starting walk to', x);
	const dir = Math.sign(x - character.x);
	character.flip = dir < 0;
	character.graphic.play('walk');
	while (Math.sign(x - character.x) === dir) {
		character.x += dir * speed;
		yield;
	}
	character.graphic.play('idle');
}

function* colorShift(target, from, to) {
	target.graphic.color = 'white';
	yield* yieldFor(4);
	for (let i = 0; i < 2; ++i) {
		target.graphic.color = from;
		yield* yieldFor(4);
		target.graphic.color = 'white';
		yield* yieldFor(4);
	}
	target.graphic.color = to;
}

function* punch(character, punchee, from, to, sound) {
	character.graphic.play('punch');
	Sfx.play(sound);
	yield* yieldFor(12);
	yield* colorShift(punchee, from, to);
}

function* logoAnimation(mrClean, logo, enemy, bubble, assetManager) {
	const enemyStartX = enemy.x;

	const thud = assetManager.audio.get(ASSETS.THUNK);
	const whack = assetManager.audio.get(ASSETS.WHACK);
	const dieSfx = assetManager.audio.get(ASSETS.ACH);

	if (true) {
		if (true) {
			// mr clean enter, stage left
			yield* walkTo(mrClean, 150, speed);

			// punch logo
			yield* punch(mrClean, logo, logoDimmed, logoColor, thud);

			// mr clean exit, stage left
			yield* walkTo(mrClean, -20, speed);
		}

		// enemy enter, stage right
		yield* walkTo(enemy, 240 + 150, speed);

		if (true) {
			// check around
			yield* yieldFor(45);
			enemy.flip = false;
			yield* yieldFor(45);
			enemy.flip = true;
			yield* yieldFor(45);
		}

		yield* walkTo(enemy, 240 + 90, speed);

		yield* punch(enemy, logo, logoColor, logoDimmed, whack);

		mrClean.x = enemyStartX;
		mrClean.graphic.play('walk');
		mrClean.flip = true;
		enemy.graphic.play('walk');
		enemy.flip = false;

		while (mrClean.x > 430 || enemy.x < 370) {
			if (mrClean.x > 430) mrClean.x -= speed;
			else mrClean.graphic.play('idle');
			if (enemy.x < 370) enemy.x += speed;
			else enemy.graphic.play('idle');
			yield;
		}
		mrClean.graphic.play('idle');
		enemy.graphic.play('idle');

		yield* punch(mrClean, enemy, 'white', undefined, dieSfx);

		enemy.graphic.play('death');

		yield* yieldFor(24);

		mrClean.graphic.play('idle');
		yield* yieldFor(45);

		yield* walkTo(mrClean, enemyStartX, speed);
	}

	while (bubble.x > 260) {
		bubble.x -= 1;
		bubble.graphic.y = Math.sin(bubble.x / 30) * 5;
		yield;
	}

	Sfx.play(assetManager.audio.get(ASSETS.POP));

	while (bubble.x > 240) {
		bubble.x -= 1;
		bubble.graphic.y = Math.sin(bubble.x / 30) * 5;
		yield;
	}

	bubble.graphic.scale = 7;
	bubble.graphic.alpha = 0.5;

	yield* colorShift(logo, logoDimmed, logoColor);

	logo.animated = true;
}

export class MenuOptions extends Entity {
	optionSelected = 0;
	inc = 0;
	active = true;

	constructor(x, y, menuOptions) {
		super(x, y);

		this.graphic = new GraphicList();

		let startY = 0;
		startY -= ((menuOptions.length - 1) * leading) / 2;
		this.menuOptions = [...menuOptions].map(({ str }, i) => {
			return {
				...menuOptions[i],
				text: this.addText(str, 0, startY + i * leading, 32),
			};
		});

		this.cursors = ['>', '<'].map((str, i) => {
			const offset = (i * 2 - 1) * 30;
			const text = this.addText(str, 0, 50, 32);
			text.x = offset;
			return text;
		});

		this.updateSelection();
	}

	update(input) {
		if (this.active) {
			const dirY =
				+input.keyPressed('ArrowDown') - +input.keyPressed('ArrowUp');

			this.updateSelection(dirY);

			const menuOption = this.menuOptions[this.optionSelected];

			const continueKeys = [' ', 'Enter', 'Return', 'z', 'Z', 'x', 'X'];
			if (input.keyPressed(continueKeys)) {
				menuOption.callback();
			}
		} else {
			this.updateSelection();
		}

		++this.inc;
	}

	updateSelection(dirY = 0) {
		const optionCount = this.menuOptions.length;
		this.optionSelected += dirY;
		this.optionSelected = (this.optionSelected + optionCount) % optionCount;
		for (let i = 0; i < optionCount; ++i) {
			this.menuOptions[i].text.color =
				i === this.optionSelected ? '#ddf' : '#99b';
		}
		const menuOption = this.menuOptions[this.optionSelected].text;
		let x = menuOption.width / 2 + 10;
		if (Math.floor(this.inc / 30) % 2 === 0) {
			x += 4;
		}
		const y = menuOption.y - 2;
		this.cursors.forEach((cursor) => {
			cursor.y = y;
			cursor.x = x * Math.sign(cursor.x);
		});
	}

	addText(str, x, y, size) {
		const text = new Text(str, x, y);
		// const text = new Text(str, 0, 0);
		text.font = 'Skullboy';
		text.size = size;
		text.centerOO();
		this.graphic.add(text);
		return text;
	}
}

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

class Bubble extends Entity {
	constructor(x, y, asset) {
		super(x, y);
		this.graphic = new Sprite(asset);
		this.graphic.centerOO();
	}
}

class MenuCharacter extends Entity {
	flip = false;

	constructor(x, y, flipOffset, asset) {
		super(x, y);

		this.flipOffset = flipOffset;

		const w = 80.0;
		const h = 80.0;

		this.collider = {
			type: 'rect',
			tag: 'CHAR',
			x: -10,
			y: -20,
			w: 20,
			h: 20,
		};

		this.depth = -1;

		this.graphic = new AnimatedSprite(asset, 80, 80);
		this.graphic.centerOO();
		this.graphic.originY = 0;
		this.graphic.offsetY = 0;
		this.graphic.y = -h;

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 5, 6], 8, false);
		this.graphic.add('death', [12, 13, 14], 60, false);
		this.graphic.add('stuck', [14], 60, false);

		this.updateGraphic();
	}

	updateGraphic() {
		this.graphic.x = this.flip ? -this.flipOffset : this.flipOffset;
		this.graphic.scaleX = this.flip ? -1 : 1;
	}

	update(input) {
		super.update(input);
		this.updateGraphic();
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

		const { assetManager } = engine;

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

		const canvasCenterX = engine.canvas.width >> 1;
		const canvasCenterY = engine.canvas.height >> 1;

		const logoSprite = new Sprite(assetManager.sprites.get(ASSETS.LOGO));
		const logoDim = [canvasCenterX, (logoSprite.height >> 1) + 30];
		const logo = this.addGraphic(logoSprite, ...logoDim);
		logo.graphic.centerOO();
		logo.graphic.color = logoDimmed;
		this.logo = logo;

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

		const options = new MenuOptions(
			canvasCenterX,
			canvasCenterY + 10,
			menuOptions,
		);
		this.options = options;
		this.addEntity(options);
		this.addRenderable(options);

		[
			['Move', 'Arrow keys'],
			['Bubble', 'Z'],
			['Punch', 'Spacebar'],
		].forEach(([x, y], i) => {
			const xx = i - 1;
			const yy = xx ? 0 : 0;
			const top = this.addText(x, canvasCenterX + xx * 110, 248 + yy, 24);
			const bot = this.addText(
				y.toUpperCase(),
				canvasCenterX + xx * 110,
				248 + yy + 20,
				32,
			);
			top.graphic.color = '#889';
		});

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

		const mrClean = new MenuCharacter(
			-50,
			120,
			10,
			assetManager.sprites.get(ASSETS.MRCLEAN_PNG),
		);
		const grimey = new MenuCharacter(
			engine.canvas.width + 50,
			120,
			10,
			assetManager.sprites.get(ASSETS.BADGUY_PNG),
		);
		grimey.flip = true;
		grimey.updateGraphic();
		const bubble = new Bubble(
			engine.canvas.width + 50,
			logo.y,
			assetManager.sprites.get(ASSETS.BUBBLES2_PNG),
		);
		this.bubble = bubble;
		[mrClean, grimey, bubble].forEach((e) => {
			this.addEntity(e);
			this.addRenderable(e);
		});
		this.gen = logoAnimation(mrClean, logo, grimey, bubble, assetManager);
	}

	goToLevel() {
		const Level = this.Level;
		this.engine.pushScene(new Level(this.engine));
	}

	goToCredits() {
		this.creditsOpen = true;
	}

	angle = 0;
	animScale = 0;

	update(input) {
		super.update(input);

		this.gen.next().value;

		if (this.logo.animated) {
			++this.animScale;
			const t = Math.clamp(this.animScale / 60, 0, 1);
			const scaleMul = Math.lerp(1, 1.2, t);
			const angleAdd = Math.lerp(0, 2, t);

			const angle = Math.sin(this.angle / 30) * 3;
			const scale = scaleMul + Math.sin(this.angle / 50) * 0.2;
			this.angle += angleAdd;

			this.logo.graphic.angle = angle;
			this.logo.graphic.scale = scale;
			this.bubble.graphic.angle = angle;
			this.bubble.graphic.scale = scale * 8;
		}

		if (this.creditsOpen) {
			if (input.keyPressed('Escape', 'Enter', ' ', 'Return')) {
				this.creditsOpen = false;
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
		this.options.active = !this.creditsOpen;

		this.credits.forEach((credit) => {
			credit.setTime(t);
		});
	}

	addText(str, x, y, size) {
		const text = new Text(str);
		text.font = 'Skullboy';
		text.size = size;
		text.centerOO();
		return this.addGraphic(text, x, y);
	}

	addGraphic(graphic, x, y) {
		const entity = new Entity(x, y);
		entity.graphic = graphic;
		this.addEntity(entity);
		this.addRenderable(entity);
		return entity;
	}
}
