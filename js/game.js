import {
	AssetManager,
	Game,
	Scene,
	Entity,
	Draw,
} from './canvas-lord/canvas-lord.js';
import { Vec2 } from './canvas-lord/util/math.js';
import { Random } from './canvas-lord/util/random.js';
import { Sprite } from './canvas-lord/util/graphic.js';
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
	BG_PNG: 'bg.png',
	BG2_PNG: 'bg2.png',
};

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

		this.y = canvas_height - asset.height * 0.5;
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

	render(ctx, camera) {
		this.graphic.color = this.hitFlash ? 'white' : undefined;
		super.render(ctx, camera);
	}
}

class Mole extends Character {
	constructor(x, y, assetManager) {
		super(x, y);
		const asset = assetManager.sprites.get(ASSETS.MOLE_SKETCH_NO_BG_PNG);

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

		const speed = 10.0;
		if (input.keyCheck('a')) {
			this.x -= speed;
		} else if (input.keyCheck('d')) {
			this.x += speed;
		}

		if (input.keyCheck('w')) {
			this.y -= speed;

			if (this.y < 150.0) {
				this.y = 150.0;
			} else {
				this.x -= speed * 0.5;
			}
		} else if (input.keyCheck('s')) {
			this.y += speed;

			if (this.y > 400.0) {
				this.y = 400.0;
			} else {
				this.x += speed * 0.5;
			}
		}
		this.depth = -this.y;

		this.hitFlash = input.keyCheck(' ');
	}
}

class Grimey extends Character {
	constructor(x, y, assetManager) {
		super(x, y);
		const asset = assetManager.sprites.get(ASSETS.MOLE_SKETCH_PNG);

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

		if (Math.sign(this.follow.x - followX) === dir) {
			const targetX = this.follow.x + innerDist * dir;
			const dist = targetX - x;
			const spd = Math.min(Math.abs(dist), this.speed);
			this.x += Math.sign(dist) * spd;
		}

		if (Math.sign(this.follow.x - toggleX) == -dir) {
			this.dir = Math.sign(this.follow.x - toggleX);
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
		for (var i = 0; i < 15; i++) {
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
