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

let inDebug = JSON.parse(localStorage.getItem('debug'));

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

		this.graphic = new Sprite(asset);
		this.graphic.centerOrigin();
		this.graphic.scale = 0.25;
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

		this.graphic = new Sprite(asset);
		this.graphic.centerOrigin();
		this.graphic.scale = 0.25;
	}

	update(input) {
		super.update(input);
		this.depth = -this.y;
	}
}

class CameraManager extends Entity {
	innerDist = 75;
	outerDist = 125;
	dir = 1;

	constructor(follow) {
		super(0, 0);
		this.follow = follow;
		this.depth = -Infinity;
		this.visible = inDebug;
	}

	update(input) {
		const newX = this.follow.x - this.scene.engine.canvas.width * 0.5;
		this.scene.camera.x = newX;

		if (this.scene.camera.x < 0) {
			this.scene.camera.x = 0;
		}

		this.visible = inDebug;
	}

	render(ctx, camera) {
		if (!this.visible) return;

		ctx.save();
		const canvasW = ctx.canvas.width;
		const canvasH = ctx.canvas.height;
		const canvasCenterX = canvasW >> 1;
		const canvasCenterY = canvasH >> 1;
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'white';
		const drawLine = (w, h) => {
			const x1 = canvasCenterX - w;
			const x2 = canvasCenterX + w;
			const y1 = canvasCenterY - h;
			const y2 = canvasCenterY + h;
			Draw.line(ctx, { color: 'white' }, x1, y1, x2, y2);
		};

		const size = 20;
		drawLine(size, 0);
		drawLine(0, size);

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

		const random = new Random(inDebug ? 78493 : undefined);
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
	game.backgroundColor = '#6c6d71';

	const scene = new Level(game);

	game.pushScene(scene);
	game.render();
});
assetManager.loadAssets();
