import {
	AssetManager,
	Game,
	Scene,
	Entity,
	Draw,
} from './canvas-lord/canvas-lord.js';
import { Vec2 } from './canvas-lord/util/math.js';
import { Random } from './canvas-lord/util/random.js';
import { Sprite, AnimatedSprite } from './canvas-lord/util/graphic.js';
import { initDebug } from './debug.js';

const defaultSettings = {
	showCamera: false,
	showHitboxes: false,
	seed: undefined,
	cameraInner: 75,
	cameraOuter: 125,
	cameraSpeed: 20,
};
const settings = Object.assign(
	{},
	defaultSettings,
	JSON.parse(localStorage.getItem('settings')) ?? {},
);

// delete old keys
Object.keys(settings).forEach((key) => {
	if (!(key in defaultSettings)) {
		delete settings[key];
	}
});

const ASSETS = {
	MOLE_SKETCH_PNG: 'mole-sketch.png',
	MOLE_SKETCH_NO_BG_PNG: 'mole-sketch-no-bg.png',
	MRCLEAN_PNG: 'mr_clean.png',
	BG_PNG: 'bg.png',
	BG2_PNG: 'bg2.png',
	FLOORS_PNG: 'floors.png',
};

class Tile extends Entity {
	constructor(x, y, assetManager) {
		super(x, y);
		const asset = assetManager.sprites.get('floors.png');

		this.graphic = new Sprite(asset);
	}

	update(input) {
		const limit = 1000;
		this.x =
			Math.floor((this.scene.camera.x * this.graphic.scrollX) / limit) *
			limit;
	}
}

class Background extends Entity {
	constructor(asset_name, canvas_height, assetManager) {
		super(0, 0);
		const asset = assetManager.sprites.get(asset_name);

		this.graphic = new Sprite(asset);
		this.graphic.scale = 0.5;
		this.depth = 1;

		if (asset_name == ASSETS.BG2_PNG) {
			this.graphic.scrollX = 0.5;
			this.depth = 2;
		}

		this.y = canvas_height - 150 - asset.height * 0.5;
	}

	update(input) {
		const limit = 1000;
		this.x =
			Math.floor((this.scene.camera.x * this.graphic.scrollX) / limit) *
			limit;
	}
}

class Character extends Entity {
	hitFlash = false;
	invFrames = 0;
	health = 8;

	hurt(pts) {
		if (this.invFrames > 0) {
			return;
		}

		console.log('Ouch!');
		if (this.health <= pts) {
			this.health = 0;
		} else {
			this.health -= pts;
		}
		this.invFrames = 30;
	}

	update(input) {
		super.update(input);

		if (this.invFrames > 0) {
			this.invFrames -= 1;
		}

		this.hitFlash = this.invFrames % 8 >= 4;
	}

	render(ctx, camera) {
		this.graphic.color = this.hitFlash ? 'white' : undefined;
		super.render(ctx, camera);
	}
}

class Hitbox extends Entity {
	time = 0;

	constructor(x, y) {
		super(x, y);
		this.collider = {
			type: 'rect',
			tag: 'HITBOX',
			x: 0,
			y: 0,
			w: 20,
			h: 20,
		};

		this.time = 30;
	}

	update(input) {
		this.time -= 1;
		if (this.time == 0) {
			this.scene.removeRenderable(this);
			this.scene.removeEntity(this);
		}
	}
}

const keysU = ['w', 'W', 'ArrowUp'];
const keysD = ['s', 'S', 'ArrowDown'];
const keysL = ['a', 'A', 'ArrowLeft'];
const keysR = ['d', 'D', 'ArrowRight'];

class Mole extends Character {
	flip = false;
	hitbox = null;

	constructor(x, y, assetManager) {
		super(x, y);

		const scale = 1.0;
		const asset = assetManager.sprites.get('mr_clean.png');
		const w = asset.width * 0.25 * scale;
		const h = asset.height * scale;

		this.collider = {
			type: 'rect',
			x: 0,
			y: 0,
			w,
			h,
		};

		this.graphic = new AnimatedSprite(asset, 44, 79);
		this.graphic.centerOO();
		this.graphic.originY = 0;
		this.graphic.offsetY = 0;
		this.graphic.y = -h;
		this.graphic.scale = scale;

		this.collider.x = this.graphic.x + this.graphic.originX;
		this.collider.y = this.graphic.y + this.graphic.originY;

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 16);
	}

	update(input) {
		super.update(input);

		const speed = 2.0;

		let moveVec = new Vec2(0, 0);

		let walking = false;
		moveVec.x = +input.keyCheck(keysR) - +input.keyCheck(keysL);
		moveVec.y = +input.keyCheck(keysD) - +input.keyCheck(keysU);

		if (moveVec.magnitude > 0) {
			moveVec = moveVec.scale(speed);
			walking = true;
			this.flip = moveVec.x ? moveVec.x < 0 : moveVec.y < 0;
		}

		this.x += speed * moveVec.x;
		this.y += speed * moveVec.y;

		const minY = 150;
		const maxY = 400;
		this.y = Math.clamp(this.y, minY, maxY);

		if (input.keyPressed(' ')) {
			var xx = this.x + this.y * 0.25;
			xx += this.flip ? -20.0 : 22.0 + 20.0;

			var e = new Hitbox(xx, this.y);
			this.scene.addEntity(e);
			this.scene.addRenderable(e);
			this.hitbox = e;
		}

		this.graphic.play(walking ? 'walk' : 'idle');
		this.depth = -this.y;

		this.graphic.x = -(this.y - minY) * 0.25;
	}

	render(ctx, camera) {
		this.graphic.scaleX = this.flip ? -1.0 : 1.0;

		const drawX = this.x + this.graphic.x - camera.x;
		const drawY = this.y - camera.y;

		const r = 12;
		const circleOptions = {
			type: 'fill',
			color: '#88888888',
			radius: r,
			scaleX: 2,
		};
		Draw.circle(ctx, circleOptions, drawX - r * 2, drawY - r, r);

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
		Draw.rect(
			ctx,
			rectOptions,
			20.0,
			20.0,
			(this.health / 10) * 200.0,
			32.0,
		);
		rectOptions.color = 'black';
		Draw.rect(
			ctx,
			rectOptions,
			20.0 + (this.health / 10) * 200.0,
			20.0,
			(1.0 - this.health / 10) * 200.0,
			32.0,
		);

		// Draw.rect(ctx, rectOptions, (this.x + this.collider.x) - camera.x, (this.y + this.collider.y) - camera.y, this.collider.w, this.collider.h);
	}
}

class Grimey extends Character {
	collider = {
		type: 'rect',
		x: -532 * 0.125,
		y: 546 * 0.0625,
		w: 532 * 0.25,
		h: 546 * 0.0625,
	};

	constructor(x, y, assetManager) {
		super(x, y);
		const asset = assetManager.sprites.get('mr_clean.png');

		const scale = 0.25;

		const w = asset.width * scale;
		const h = asset.height * scale;

		this.collider = {
			type: 'rect',
			x: -w >> 1,
			y: -h >> 1,
			w,
			h,
		};

		this.graphic = new Sprite(asset);
		this.graphic.centerOrigin();
		this.graphic.scale = scale;
	}

	update(input) {
		super.update(input);
		this.depth = -this.y;

		const px = this.scene.player.x - this.scene.player.y * 0.25;
		const py = this.scene.player.y;
		const speed = 0.5;

		var nx = this.x;
		var ny = this.y;
		if (nx > px) {
			nx -= speed;
		} else if (nx < px) {
			nx += speed;
		}

		if (ny > py) {
			ny -= speed;
		} else if (ny < py) {
			ny += speed;
		}

		if (!this.collide(nx, this.y)) {
			this.x = nx;
		}

		if (!this.collide(this.x, ny)) {
			this.y = ny;
		}
	}

	render(ctx, camera) {
		this.collider.x = this.y * 0.25 + -532 * 0.125;
		this.graphic.x = this.y * 0.25;

		super.render(ctx, camera);
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
		this.depth = -Infinity;
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

		if (settings.showCamera && input.keyPressed('q')) {
			this.dir = -1;
		}
		if (settings.showCamera && input.keyPressed('e')) {
			this.dir = 1;
		}

		const { x, innerDist, outerDist, dir } = this;
		let forceX = x + innerDist * dir;
		let toggleX = x - outerDist * dir;
		let followX = x - innerDist * dir;
		if (dir == 1) {
			--forceX;
			--toggleX;
		}

		const realFollowX = this.follow.x; // + this.follow.graphic.x;
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

		drawPair(this.innerDist, 60);
		ctx.setLineDash([7, 7]);
		drawPair(this.outerDist, 90);

		ctx.restore();
	}
}

class Level extends Scene {
	constructor(engine) {
		super(engine);

		const canvasSize = new Vec2(engine.canvas.width, engine.canvas.height);
		const canvasCenter = canvasSize.scale(0.5);

		const mole = new Mole(canvasCenter.x, canvasCenter.y, assetManager);
		this.player = mole;

		const cameraManager = new CameraManager(this.player);

		const bg2 = new Background(ASSETS.BG2_PNG, canvasSize.y, assetManager);
		const bg = new Background(ASSETS.BG_PNG, canvasSize.y, assetManager);
		[bg, bg2, mole, cameraManager].forEach((e) => {
			this.addEntity(e);
			this.addRenderable(e);
		});

		const random = new Random(settings.seed);
		for (var i = 0; i < 5; i++) {
			const e = new Grimey(
				random.float(8000),
				game.canvas.height - random.float(200),
				assetManager,
			);

			this.addEntity(e);
			this.addRenderable(e);
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
			updateMode: 'focus', // or set it to 'focus'
			renderMode: 'onUpdate',
		},
	});
	game.assetManager = assetManager;
	game.backgroundColor = '#6c6d71';

	const scene = new Level(game);
	game.pushScene(scene);
	game.render();

	initDebug(game, settings, defaultSettings);
});
assetManager.loadAssets();
