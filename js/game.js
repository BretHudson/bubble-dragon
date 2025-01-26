import {
	AssetManager,
	Sfx,
	Game,
	Scene,
	Entity,
	Draw,
} from './canvas-lord/canvas-lord.js';
import { Vec2 } from './canvas-lord/util/math.js';
import { Random } from './canvas-lord/util/random.js';
import {
	Text,
	Sprite,
	AnimatedSprite,
	GraphicList,
} from './canvas-lord/util/graphic.js';
import { initDebug } from './debug.js';
import { Menu, MenuOptions } from './menu.js';

const defaultSettings = {
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
};
const settings = Object.assign(
	{},
	defaultSettings,
	JSON.parse(localStorage.getItem('settings')) ?? {},
);

const minY = 200;
const maxY = 380;
const centerY = (maxY - minY) / 2 + minY;
const random = new Random(settings.seed);

var over = false;

// delete old keys
Object.keys(settings).forEach((key) => {
	if (!(key in defaultSettings)) {
		delete settings[key];
	}
});

const loadFont = async (name, fileName) => {
	const font = new FontFace(name, `url("${fileName}")`);
	await font.load();
	document.fonts.add(font);
};
await loadFont('Skullboy', './fonts/ChevyRay - Skullboy.ttf');
await loadFont('Skullboy Mono', './fonts/ChevyRay - Skullboy Mono.ttf');

const ASSETS = {
	MRCLEAN_PNG: 'mr_clean.png',
	BADGUY_PNG: 'badguy.png',
	BG_PNG: 'bg.png',
	BG2_PNG: 'bg2.png',
	BUBBLES2_PNG: 'bubbles2.png',
	FLOOR_PNG: 'floor.png',
	FLOOR_GRADIENT_PNG: 'floor_gradient.png',

	// backgrounds
	BG_SUNSET: 'bg_0_sunset.png', // static
	BG_CLOUD: 'bg_1_clouds.png', // static
	BG_PYRAMIDS: 'pyramids.png', // parallax
	BG_SKYSCRAPERS: 'parallax_parts_skyscrapers.png', // parallax
	BG_FG: 'parallax_parts_fg.png', // parallax

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

const DEPTH = {
	BACKGROUND: 1000,
	BUILDINGS: 100,
	TILES: 10,
	OVERLAY: -1000,
	CAMERA: -Infinity,
};

const punch_sfx = [
	ASSETS.THUD,
	ASSETS.THUNK,
	ASSETS.WHACK,
	ASSETS.ACH,
	ASSETS.OW,
	ASSETS.UGH,
	ASSETS.WUGH,
];

const tileStartY = minY - 10;

class Tiles extends Entity {
	constructor(assetManager) {
		super(0, 0);

		const asset = assetManager.sprites.get(ASSETS.FLOOR_PNG);
		this.graphic = new GraphicList();
		this.depth = ASSETS.TILES;

		const { width, height } = asset;

		var s = Sprite.createRect(width * 10, 480, '#101010');
		s.x = 0;
		s.y = tileStartY;
		this.graphic.add(s);

		const xSize = 5;
		for (var i = -xSize; i <= xSize; i++) {
			this.graphic.add(new Sprite(asset, width * i, tileStartY));
		}

		const gradient = new Sprite(
			assetManager.sprites.get(ASSETS.FLOOR_GRADIENT_PNG),
			0,
			tileStartY,
		);
		gradient.alpha = 0.7;
		gradient.scaleX = (width * 10) / gradient.width;
		this.graphic.add(gradient);
	}

	update(input) {
		const asset = assetManager.sprites.get(ASSETS.FLOOR_PNG);
		const limit = asset.width * 3;
		this.x = Math.floor(this.scene.camera.x / limit) * limit;
	}
}

class BubbleTrap extends Entity {
	t = 0.0;
	dir = 0.0;
	baseline = 0.0;

	constructor(x, y, dir) {
		super(x, y);

		this.graphic = new Sprite(
			assetManager.sprites.get(ASSETS.BUBBLES2_PNG),
		);
		this.graphic.centerOrigin();
		this.graphic.scale = 2.0;
		this.baseline = y;
		this.dir = dir;
		this.depth = -y;
		this.collider = {
			type: 'rect',
			tag: 'BUBBLE',
			// yes i moved it slightly down on purpose
			x: -20,
			y: -10,
			w: 40,
			h: 40,
		};

		console.log(x, y);
	}

	update(input) {
		this.t += 10.0 / 60.0;

		this.x += this.dir * 1.5;
		this.y = this.baseline + Math.sin(this.t * 0.5) * 16.0;

		var view_x = this.x - this.scene.camera.x;
		if (view_x < 0.0 || view_x >= this.scene.engine.canvas.width) {
			if (this.caught) {
				this.caught.bubble = null;
				this.caught.graphic.y = -80.0;
				this.caught.graphic.scale = 1.0;
			}

			Sfx.play(assetManager.audio.get(ASSETS.POP));

			this.scene.removeRenderable(this);
			this.scene.removeEntity(this);
			this.scene = null;
		}

		if (!this.caught) {
			// if an enemy gets caught by a bubble we wanna drag them with it
			const e = this.collideEntity(this.x, this.y, ['CHAR']);
			if (
				e != null &&
				e != this.owner &&
				e instanceof Grimey &&
				!e.bubble
			) {
				e.bubble = this;
				e.anim_state = -1;
				e.graphic.scale = 0.5;
				e.graphic.y = -30.0;
				e.graphic.play('stuck');

				this.caught = e;
			}
		}
	}
}

class CoolScreen extends Entity {
	fade = 0.0;

	constructor(txt, w, h) {
		super(w / 2, h / 2);

		this.graphic = new GraphicList();

		this.bg = Sprite.createRect(w, h, 'black');
		this.bg.centerOrigin();
		this.bg.scrollX = 0.0;
		this.graphic.add(this.bg);

		this.txt = new Text(txt, 0, 0);
		this.txt.size = 20.0;
		this.txt.scrollX = 0.0;
		this.txt.centerOrigin();
		this.graphic.add(this.txt);
		this.depth = DEPTH.OVERLAY;
	}

	update(input) {
		this.fade += 1.0 / 60.0;
		if (this.fade > 1.0) {
			this.fade = 1.0;
		}

		this.bg.alpha = this.fade;

		this.visible = !settings.hideOverlay;
	}
}

class Character extends Entity {
	hitFlash = false;
	invFrames = 0;
	health = 10;

	anim_state = 0;
	hitbox = null;

	flipOffset = 0;

	constructor(x, y, asset, initialHealth) {
		super(x, y);

		this.health = initialHealth;

		const h = 80.0;

		this.collider = {
			type: 'rect',
			tag: 'CHAR',
			x: -10,
			y: -20,
			w: 20,
			h: 20,
		};

		this.graphic = new AnimatedSprite(asset, 80, 80);
		this.graphic.centerOO();
		this.graphic.originY = 0;
		this.graphic.offsetY = 0;
		this.graphic.y = -h;

		this.updateGraphic();
	}

	onDeath() {
		this.scene.removeRenderable(this);
		this.scene.removeEntity(this);
		this.scene = null;
	}

	getImageXOffset() {
		return 0;
		return -(this.y - minY) + (centerY - minY);
	}

	updateGraphic() {
		this.graphic.x = this.getImageXOffset();
		this.graphic.x += this.flip ? -this.flipOffset : this.flipOffset;
	}

	hurt(pts) {
		if (this.invFrames > 0) {
			return false;
		}

		if (this.health <= pts) {
			this.health = 0;
			this.onDeath();
		} else {
			this.health -= pts;
		}
		this.invFrames = 30;
		return true;
	}

	update(input) {
		super.update(input);

		this.depth = -this.y;

		this.updateGraphic();

		if (this.invFrames > 0) {
			this.invFrames -= 1;
		}

		this.graphic.scaleX = this.flip ? -1.0 : 1.0;
		this.hitFlash = this.invFrames % 8 >= 4;
	}

	render(ctx, camera) {
		const drawX = this.x - camera.x;
		const drawY = this.y - camera.y;

		const r = 9;
		const circleOptions = {
			type: 'fill',
			color: '#00000033',
			radius: r,
			scaleX: 2,
		};
		Draw.circle(ctx, circleOptions, drawX - r * 2, drawY - r, r);
		Draw.circle(
			ctx,
			{
				...circleOptions,
				color: '#ffffff22',
				type: 'stroke',
			},
			drawX - r * 2 + this.getImageXOffset(),
			drawY - r,
			r,
		);

		this.graphic.color = this.hitFlash ? 'white' : undefined;
		super.render(ctx, camera);
	}
}

class Hitbox extends Entity {
	time = 0;
	owner = null;
	dmg = 0;

	constructor(o, d, x, y) {
		super(x, y);
		this.dmg = d;
		this.owner = o;
		this.collider = {
			type: 'rect',
			tag: 'HITBOX',
			x: 0,
			y: -5,
			w: 20,
			h: 30,
		};

		this.time = 20;
	}

	update(input) {
		if (this.time <= 10) {
			const e = this.collideEntity(this.x, this.y, ['CHAR']);
			if (e != null && e != this.owner && e instanceof Character) {
				if (e.hurt(this.dmg)) {
					const asset = assetManager.audio.get(
						random.choose(punch_sfx),
					);
					Sfx.play(asset);
				}
			}
		}

		this.time -= 1;
		if (this.time == 0) {
			this.scene.removeRenderable(this);
			this.scene.removeEntity(this);
			this.scene = null;
		}
	}
}

const keysU = ['w', 'W', 'ArrowUp'];
const keysD = ['s', 'S', 'ArrowDown'];
const keysL = ['a', 'A', 'ArrowLeft'];
const keysR = ['d', 'D', 'ArrowRight'];

const states2anim = ['idle', 'walk', 'punch'];

class Player extends Character {
	flip = false;

	bubble_ticks = 0;
	bubbles = 3;

	constructor(x, y, assetManager) {
		const asset = assetManager.sprites.get('mr_clean.png');
		super(x, y, asset, 10);

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 6], 8);

		this.flipOffset = 10;
	}

	onDeath() {
		if (!over) {
			var e = new CoolScreen(
				'You fugging died!',
				this.scene.engine.canvas.width,
				this.scene.engine.canvas.height,
			);
			this.scene.addEntity(e);
			this.scene.addRenderable(e);

			over = true;
		}

		super.onDeath();
	}

	update(input) {
		if (this.over) {
			return;
		}

		if (settings.invincible) this.health = 10;

		if (this.bubbles < 3) {
			this.bubble_ticks += 1;
			if (this.bubble_ticks > 120) {
				this.bubbles += 1;
				this.bubble_ticks = 0;
			}
		}

		let walking = false;
		var next_state = 0;
		if (this.hitbox !== null) {
			// hitbox died, we can hit again
			if (!this.hitbox.scene) {
				this.hitbox = null;
			}
		} else {
			const speed = settings.playerSpeed;
			let moveVec = new Vec2(0, 0);

			moveVec.x = +input.keyCheck(keysR) - +input.keyCheck(keysL);
			moveVec.y = +input.keyCheck(keysD) - +input.keyCheck(keysU);

			if (moveVec.magnitude > 0) {
				moveVec = moveVec.scale(speed);
				next_state = 1;
				this.flip = moveVec.x ? moveVec.x < 0 : moveVec.y < 0;
			}

			this.x += speed * moveVec.x;
			this.y += speed * moveVec.y;
			this.y = Math.clamp(this.y, minY, maxY);

			if (input.keyPressed('z') && this.bubbles > 0) {
				this.bubbles -= 1;
				this.bubble_ticks = 0;

				var e = new BubbleTrap(
					this.x,
					this.y - 50.0,
					this.flip ? -1.0 : 1.0,
				);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);
			}

			if (input.keyPressed(' ')) {
				var xx = this.x + (this.flip ? -30.0 : 10.0);

				var e = new Hitbox(this, 2, xx, this.y - 20.0);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);
				this.hitbox = e;
				next_state = 2;
			}

			if (this.anim_state != next_state) {
				this.graphic.play(states2anim[next_state]);
				this.anim_state = next_state;
			}
		}

		super.update(input);
	}

	render(ctx, camera) {
		super.render(ctx, camera);

		const rectOptions = {
			type: 'fill',
			angle: 0.0,
			scaleX: 1.0,
			scaleY: 1.0,
			originX: 0.0,
			originY: 0.0,
			offsetX: 0.0,
			offsetY: 0.0,
		};

		rectOptions.color = 'red';
		Draw.rect(ctx, rectOptions, 8.0, 8.0, (this.health / 10) * 100.0, 16.0);
		rectOptions.color = 'black';
		Draw.rect(
			ctx,
			rectOptions,
			8.0 + (this.health / 10) * 100.0,
			8.0,
			(1.0 - this.health / 10) * 100.0,
			16.0,
		);

		const imageOptions = {
			angle: 0.0,
			scaleX: 1.0,
			scaleY: 1.0,
			originX: 0,
			originY: 0,
			offsetX: 0,
			offsetY: 0,
			imageSrc: assetManager.sprites.get(ASSETS.BUBBLES2_PNG).image,
		};

		for (var i = 0; i < this.bubbles; i++) {
			Draw.image(ctx, imageOptions, 8.0 + i * 32.0, 32.0);
		}
	}
}

class Grimey extends Character {
	death_fade = 0.0;

	constructor(x, y, assetManager) {
		const asset = assetManager.sprites.get('badguy.png');
		super(x, y, asset, 6);

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 6], 8, false);
		this.graphic.add('death', [12, 13, 14], 60, false);
		this.graphic.add('stuck', [14], 60, false);

		this.flipOffset = 24;
	}

	onDeath() {
		const asset = assetManager.audio.get(ASSETS.CRUNCH);
		Sfx.play(asset);

		this.graphic.play('death');
		this.collider = null;
	}

	update(input) {
		if (this.health == 0) {
			if (this.graphic.frame == 2) {
				this.death_fade += 0.33 / 60.0;
				this.graphic.alpha = 1.0 - this.death_fade;
				if (this.death_fade > 1.0) {
					super.onDeath();
				}
			}
			return;
		} else if (over) {
			return;
		} else if (this.bubble != null) {
			this.x = this.bubble.x;
			this.y = this.bubble.y;
			return;
		}

		if (this.hitbox !== null) {
			// hitbox died, we can hit again
			if (!this.hitbox.scene) {
				this.hitbox = null;
			}
		} else {
			var xx = this.scene.player.x - this.x;
			var yy = this.scene.player.y - this.y;
			var dist = Math.sqrt(xx * xx + yy * yy);

			var next_state = 0;
			if (dist > 25.0) {
				const speed = 0.5;
				var dx = Math.sign(this.scene.player.x - this.x) * speed;
				var dy = Math.sign(this.scene.player.y - this.y) * speed;
				this.x += this.collide(this.x + dx, this.y, ['CHAR'])
					? 0.0
					: dx;
				this.y += this.collide(this.x, this.y + dy, ['CHAR'])
					? 0.0
					: dy;
				this.flip = dx ? dx < 0 : dy < 0;

				next_state = 1;
			} else {
				var xx = this.x + (this.flip ? -30.0 : 10.0);

				var e = new Hitbox(this, 1, xx, this.y - 20.0);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);
				this.hitbox = e;
				next_state = 2;
			}

			if (this.anim_state != next_state) {
				this.graphic.play(states2anim[next_state]);
				this.anim_state = next_state;
			}

			if (this.x < this.scene.player.x - 400.0) {
				console.log('Offscreened!');
				super.onDeath();
			}
		}

		super.update(input);
	}
}

class CameraManager extends Entity {
	innerDist = 75;
	outerDist = 125;
	speed = 20;
	dir = 1;

	constructor(follow) {
		super(0, 0);
		this.follow = follow;
		this.depth = DEPTH.CAMERA;
		this.updateSettings();
	}

	updateSettings() {
		this.visible = settings.showCamera;
		this.innerDist = +settings.cameraInner;
		this.outerDist = +settings.cameraOuter;
		this.speed = +settings.cameraSpeed;
	}

	update(input) {
		this.updateSettings();

		if (settings.showCamera) {
			if (input.keyPressed?.('q')) this.dir = -1;
			if (input.keyPressed?.('e')) this.dir = 1;
		}

		const { x, innerDist, outerDist, dir } = this;
		let forceX = x + innerDist * dir;
		let toggleX = x - outerDist * dir;
		let followX = x - innerDist * dir;
		if (dir == 1) {
			--forceX;
			--toggleX;
		}

		const realFollowX = this.follow.x;
		if (Math.sign(realFollowX - followX) === dir) {
			const targetX = realFollowX + innerDist * dir;
			const dist = targetX - x;
			const spd = Math.min(Math.abs(dist), this.speed);
			this.x += Math.sign(dist) * spd;
		}

		if (Math.sign(realFollowX - toggleX) == -dir) {
			this.dir = Math.sign(realFollowX - toggleX);
		}

		this.scene.camera.x = this.x - this.scene.engine.canvas.width * 0.5;

		if (this.scene.camera.x < 0) {
			this.scene.camera.x = 0;
		}
	}

	render(ctx) {
		if (!this.visible) return;

		ctx.save();
		const canvasW = ctx.canvas.width;
		const canvasH = ctx.canvas.height;
		const canvasCenterX = canvasW >> 1;
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'white';
		const drawPair = (xDist, yDist) => {
			const x1 = canvasCenterX - xDist;
			const x2 = canvasCenterX + xDist;
			const y1 = 0 + yDist;
			const y2 = canvasH - yDist;
			Draw.line(ctx, { color: 'white' }, x1, y1, x1, y2);
			Draw.line(ctx, { color: 'white' }, x2, y1, x2, y2);
		};

		drawPair(this.innerDist, 30);
		ctx.setLineDash([7, 7]);
		drawPair(this.outerDist, 45);

		ctx.restore();
	}
}

const levelWidth = 320;

const buildingW = 960 / 6;

let buildingIndices;
{
	const random = new Random(64673);
	buildingIndices = Array.from({ length: 100 }, (_, i) => {
		return random.int(5);
	});
}

class Buildings extends Entity {
	constructor(xOffset) {
		super(xOffset * buildingW, 0);

		this.id = xOffset;

		this.graphic = new AnimatedSprite(
			assetManager.sprites.get(ASSETS.BG_SKYSCRAPERS),
			buildingW,
			540,
		);
		this.depth = DEPTH.BUILDINGS;
		this.graphic.centerOO();

		this.graphic.scrollX = 0.25;

		this.graphic.add('0', [0], 100);
		this.graphic.add('1', [1], 100);
		this.graphic.add('2', [2], 100);
		this.graphic.add('3', [3], 100);
		this.graphic.add('4', [4], 100);

		this.updateImage();
		this.graphic.update();
	}

	updateImage() {
		this.graphic.play(buildingIndices[this.id].toString());
	}

	update() {
		const camera = this.scene.camera;
		const scrollX = this.graphic.scrollX;
		const w = buildingW / scrollX;

		const x = this.x - camera.x * scrollX;

		if (x < -buildingW) {
			this.x += buildingW * 5;
			this.id += 5;
		}
		if (x > buildingW * 4) {
			this.x -= buildingW * 5;
			this.id -= 5;
		}
	}
}

const pauseKeys = ['p', 'P', 'Escape'];

class PauseScreen extends Scene {
	constructor(engine) {
		super(engine);

		const { width, height } = this.engine.canvas;

		const rect = Sprite.createRect(width, height, '#101010');
		rect.alpha = 0.3;
		const rectEntity = new Entity();
		rectEntity.graphic = rect;
		this.addEntity(rectEntity);
		this.addRenderable(rectEntity);

		const yPad = 20;

		const text = new Text('PAUSED');
		text.font = 'Skullboy';
		text.size = 48;
		text.centerOO();
		const textEntity = new Entity(width >> 1, height >> 1);
		textEntity.y -= yPad * 2;
		textEntity.graphic = text;
		this.addEntity(textEntity);
		this.addRenderable(textEntity);

		const options = new MenuOptions(width >> 1, height >> 1, [
			{
				str: 'Resume',
				callback: () => {
					this.engine.popScenes();
				},
			},
			{
				str: 'Quit',
				callback: () => {
					// remove pause
					this.engine.popScenes();
					// remove level
					this.engine.popScenes();
				},
			},
		]);
		options.y += yPad;
		this.addEntity(options);
		this.addRenderable(options);
	}
}

class Level extends Scene {
	constructor(engine) {
		super(engine);
		over = false;

		const canvasSize = new Vec2(engine.canvas.width, engine.canvas.height);
		const canvasCenter = canvasSize.scale(0.5);

		const p = new Player(canvasCenter.x, centerY, assetManager);
		this.player = p;

		const cameraManager = new CameraManager(this.player);

		const tiles = new Tiles(assetManager);

		const entities = [
			ASSETS.BG_SUNSET,
			ASSETS.BG_CLOUD,
			ASSETS.BG_PYRAMIDS,
			// ASSETS.BG_SKYSCRAPERS,
			// ASSETS.BG_FG,
		]
			.map((asset) => assetManager.sprites.get(asset))
			.map((sprite) => {
				const entity = new Entity(
					engine.canvas.width >> 1,
					(engine.canvas.height >> 1) - 80,
				);
				entity.depth = DEPTH.BACKGROUND;
				entity.graphic = new Sprite(sprite);
				entity.graphic.scale = 0.5;
				entity.graphic.centerOO();
				return entity;
			});

		entities[0].graphic.scrollX = 0;
		entities[1].graphic.scrollX = 0;
		entities[2].graphic.scrollX = 0.025;

		for (let i = 0; i < 5; ++i) {
			const buildings = new Buildings(i);
			this.addEntity(buildings);
			this.addRenderable(buildings);
		}

		[...entities, tiles, p, cameraManager].forEach((e) => {
			this.addEntity(e);
			this.addRenderable(e);
		});

		// a lil' cheat for making the camera immediately snap
		for (let i = 0; i < 100; ++i) cameraManager.update({});
	}

	furthest_room = 0;
	room_start = 0.0;
	rooms = [320.0, 320.0, 320.0, 400.0];

	blur() {
		this.pauseGame();
	}

	pauseGame() {
		this.engine.pushScene(new PauseScreen(this.engine));
	}

	update(input) {
		super.update(input);

		if (input.keyPressed(pauseKeys)) {
			this.pauseGame();
		}

		const dist = this.player.x - this.room_start;
		if (dist > this.rooms[this.furthest_room]) {
			if (this.furthest_room == this.rooms.length - 1) {
				if (!over) {
					var e = new CoolScreen(
						'You fugging won!',
						this.engine.canvas.width,
						this.engine.canvas.height,
					);
					this.addEntity(e);
					this.addRenderable(e);
				}

				over = true;
			} else {
				this.room_start += this.rooms[this.furthest_room++];
				const n = random.int(3) + 2;
				console.log('Spawning ' + n + ' grimeys');

				for (var i = 0; i < n; i++) {
					const e = new Grimey(
						this.room_start +
							game.canvas.width * 0.5 +
							random.int(4) * 35.0,
						game.canvas.height - (i * 30.0 + 20.0),
						assetManager,
					);

					this.addEntity(e);
					this.addRenderable(e);
				}
			}
		}
	}

	render(ctx) {
		super.render(ctx);

		const { camera } = this;

		if (settings.showHitboxes) {
			this.entities.inScene.forEach((e) => {
				if (!e.collider) return;

				const r = 3;
				Draw.circle(
					ctx,
					{ type: 'fill', color: 'lime' },
					e.x - r - camera.x,
					e.y - r - camera.y,
					r,
				);
				switch (e.collider.type) {
					case 'rect':
						Draw.rect(
							ctx,
							{ type: 'stroke', color: 'red' },
							e.x + e.collider.x - camera.x,
							e.y + e.collider.y - camera.y,
							e.collider.w,
							e.collider.h,
						);
						break;
					default:
						console.warn('not supported');
				}
			});
		}
	}
}

let game;
const assetManager = new AssetManager('./img/');
Object.values(ASSETS).forEach((asset) => {
	switch (true) {
		case asset.endsWith('.png'):
			assetManager.addImage(asset);
			break;
		case asset.endsWith('.wav'):
			assetManager.addAudio(asset);
			break;
	}
});
assetManager.onLoad(() => {
	if (game) return;

	game = new Game('ggj-2025-game', {
		fps: 60,
		gameLoopSettings: {
			updateMode: 'focus', // or set it to 'focus'
			renderMode: 'onUpdate',
		},
	});
	game.assetManager = assetManager;
	game.backgroundColor = '#101010';
	game.listeners.blur.add(() => {
		const scene = game.currentScenes?.[0];
		if (scene && scene.blur) {
			scene.blur();
			window.requestAnimationFrame(() => {
				game.render();
			});
		}
	});

	const menu = new Menu(game, Level, settings.autoLevel);
	game.pushScene(menu);

	if (settings.autoLevel) {
		menu.goToLevel();
		window.requestAnimationFrame(() => {
			game.render();
		});
	}

	game.render();

	if (window.debugEnabled) {
		initDebug(game, settings, defaultSettings);
	}
});
assetManager.loadAssets();
