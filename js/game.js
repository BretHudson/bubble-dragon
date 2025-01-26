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
} from './canvas-lord/util/graphic.js';
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

class Tiles extends Entity {
	constructor(assetManager) {
		super(0, 0);

		const asset = assetManager.sprites.get(ASSETS.FLOORS_PNG);
		this.graphic = new GraphicList();

		for (var i = 0; i < 4; i++) {
			for (var j = 1; j <= 2; j++) {
				var xx = i * 93 + j * 49 * 1.0;
				var yy = 180 - j * 49;

				this.graphic.add(new Sprite(asset, xx, yy));
			}
		}
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

		this.y = canvas_height - 100 - asset.height * 0.5;
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

		this.time = 20;
	}

	update(input) {
		this.time -= 1;
		if (this.time == 0) {
			this.scene.removeRenderable(this);
			this.scene.removeEntity(this);
			this.scene = null;
		}
	}
}

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
			y: h - 20,
			w: w,
			h: 20,
		};

		this.graphic = new AnimatedSprite(asset, 44, 79);
		this.graphic.originY = -h;
		this.graphic.scale = scale;

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 8);
	}

	update(input) {
		super.update(input);

		const speed = 2.0;
		var nx = this.x;
		var ny = this.y;
		var walking = false;

		if (this.hitbox !== null) {
			// hitbox died, we can hit again
			if (!this.hitbox.scene) {
				this.hitbox = null;
			}
		} else {
			if (input.keyCheck('w')) {
				ny -= speed;
				walking = true;
				this.flip = true;

				if (ny < 20.0) {
					ny = 20.0;
				}
			} else if (input.keyCheck('s')) {
				ny += speed;
				walking = true;
				this.flip = false;

				if (ny > 100.0) {
					ny = 100.0;
				}
			}

			if (input.keyCheck('a')) {
				nx -= speed;
				walking = true;
				this.flip = true;
			} else if (input.keyCheck('d')) {
				nx += speed;
				walking = true;
				this.flip = false;
			}
		}

		this.x = nx;
		this.y = ny;

		/* if (!this.collide(nx, this.y)) {
			this.x = nx;
		}

		if (!this.collide(this.x, ny)) {
			this.y = ny;
		} */

		if (this.hitbox == null && input.keyPressed(' ')) {
			var xx = this.x + this.y * 0.25;
			xx += this.flip ? -20.0 : 22.0 + 20.0;

			var e = new Hitbox(xx, this.y);
			this.scene.addEntity(e);
			this.scene.addRenderable(e);
			this.hitbox = e;
		}

		this.graphic.play(walking ? 'walk' : 'idle');
		this.depth = -this.y;
	}

	render(ctx, camera) {
		this.graphic.scaleX = this.flip ? -1.0 : 1.0;

		var off_x = this.flip ? 44 : 0;
		this.collider.x = this.y * 0.25;
		this.graphic.x = this.y * 0.25 + off_x;

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

		// Draw.rect(ctx, rectOptions, (this.x + this.collider.x) - camera.x, (this.y + this.collider.y) - camera.y, this.collider.w, this.collider.h);
	}
}

class Grimey extends Character {
	constructor(x, y, assetManager) {
		super(x, y);

		const scale = 1.0;
		const asset = assetManager.sprites.get('mr_clean.png');
		const w = asset.width * 0.25 * scale;
		const h = asset.height * scale;

		this.collider = {
			type: 'rect',
			x: 0,
			y: h - 20,
			w: w,
			h: 20,
		};

		this.graphic = new AnimatedSprite(asset, 44, 79);
		this.graphic.originY = -h;
		this.graphic.scale = scale;
		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 16);
		this.graphic.play('walk');
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
		this.collider.x = this.y * 0.25;
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
		const tiles = new Tiles(assetManager);
		[bg, bg2, tiles, mole, cameraManager].forEach((e) => {
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
	game.backgroundColor = '#101010';

	const scene = new Level(game);
	game.pushScene(scene);
	game.render();

	initDebug(game, settings, defaultSettings);
});
assetManager.loadAssets();
