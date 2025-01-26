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
import { Menu } from './menu.js';

const defaultSettings = {
	autoLevel: false,
	showCamera: false,
	showHitboxes: false,
	seed: undefined,
	cameraInner: 40,
	cameraOuter: 132,
	cameraSpeed: 10,
};
const settings = Object.assign(
	{},
	defaultSettings,
	JSON.parse(localStorage.getItem('settings')) ?? {},
);

const minY = 80;
const maxY = 180;

// delete old keys
Object.keys(settings).forEach((key) => {
	if (!(key in defaultSettings)) {
		delete settings[key];
	}
});

const ASSETS = {
	MRCLEAN_PNG: 'mr_clean.png',
	BADGUY_PNG: 'badguy.png',
	BG_PNG: 'bg.png',
	BG2_PNG: 'bg2.png',
	FLOORS_PNG: 'floors.png',

	// backgrounds
	BG_SUNSET: 'bg_0_sunset.png', // static
	BG_CLOUD: 'bg_1_clouds.png', // static
	BG_PYRAMIDS: 'pyramids.png', // parallax
	BG_SKYSCRAPERS: 'parallax_parts_skyscrapers.png', // parallax
	BG_FG: 'parallax_parts_fg.png', // parallax

	// menu
	LOGO: 'logo.png',
};

class Tiles extends Entity {
	constructor(assetManager) {
		super(0, 0);

		const asset = assetManager.sprites.get(ASSETS.FLOORS_PNG);
		this.graphic = new GraphicList();

		for (var i = -5; i <= 5; i++) {
			for (var j = 1; j <= 2; j++) {
				var xx = i * 93 + j * 49 * 1.0;
				var yy = 180 - j * 49;

				this.graphic.add(new Sprite(asset, xx, yy));
			}
		}
	}

	update(input) {
		const limit = 93 * 3;
		this.x = Math.floor(this.scene.camera.x / limit) * limit;
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

	anim_state = 0;
	hitbox = null;

	hurt(pts) {
		if (this.invFrames > 0) {
			return;
		}

		console.log('Ouch!');
		if (this.health <= pts) {
			this.health = 0;

			this.scene.removeRenderable(this);
			this.scene.removeEntity(this);
			this.scene = null;
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
	owner = null;

	constructor(o, x, y) {
		super(x, y);
		this.owner = o;
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
		if (this.time <= 10) {
			const e = this.collideEntity(this.x, this.y);
			if (e != null && e != this.owner) {
				e.hurt(2);
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

	constructor(x, y, assetManager) {
		super(x, y);

		const scale = 1.0;
		const asset = assetManager.sprites.get('mr_clean.png');
		const w = 80.0 * scale;
		const h = 80.0 * scale;

		this.collider = {
			type: 'rect',
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
		this.graphic.scale = scale;

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 6], 8);
	}

	update(input) {
		super.update(input);

		let walking = false;
		var next_state = 0;
		if (this.hitbox !== null) {
			// hitbox died, we can hit again
			if (!this.hitbox.scene) {
				this.hitbox = null;
			}
		} else {
			const speed = 2.0;
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

			if (input.keyPressed(' ')) {
				var xx = this.x + (this.flip ? -30.0 : 10.0);

				var e = new Hitbox(this, xx, this.y - 20.0);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);
				this.hitbox = e;

				this.graphic.play('punch');
				next_state = 2;
			}

			if (this.anim_state != next_state) {
				this.graphic.play(states2anim[next_state]);
				this.anim_state = next_state;
			}
		}

		this.depth = -this.y;
	}

	render(ctx, camera) {
		// this.graphic.x = -(this.y - minY) * 1.0;
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
		const asset = assetManager.sprites.get('badguy.png');
		const w = 80.0 * scale;
		const h = 80.0 * scale;

		this.collider = {
			type: 'rect',
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
		this.graphic.scale = scale;

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 6], 8);
	}

	update(input) {
		super.update(input);
		this.depth = -this.y;

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
				this.x += this.collide(this.x + dx, this.y) ? 0.0 : dx;
				this.y += this.collide(this.x, this.y + dy) ? 0.0 : dy;
				this.flip = dx ? dx < 0 : dy < 0;

				next_state = 1;
			} else {
				var xx = this.x + (this.flip ? -30.0 : 10.0);

				var e = new Hitbox(this, xx, this.y - 20.0);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);
				this.hitbox = e;
				this.anim_state = 2;
			}

			if (this.anim_state != next_state) {
				this.graphic.play(states2anim[next_state]);
				this.anim_state = next_state;
			}
		}
	}

	render(ctx, camera) {
		this.graphic.scaleX = this.flip ? -1.0 : 1.0;
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

		const realFollowX = this.follow.x - 50.0;
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
	const random = new Random(6465373);
	buildingIndices = Array.from({ length: 100 }, (_, i) => {
		return i % 5;
	});
}

class Buildings extends Entity {
	constructor(xOffset) {
		super(xOffset * buildingW, 0);

		this.graphic = new AnimatedSprite(
			assetManager.sprites.get(ASSETS.BG_SKYSCRAPERS),
			buildingW,
			540,
		);
		this.depth = -1;
		this.graphic.centerOO();

		this.graphic.scrollX = 0.25;

		this.graphic.add('0', [0], 100);
		this.graphic.add('1', [1], 100);
		this.graphic.add('2', [2], 100);
		this.graphic.add('3', [3], 100);
		this.graphic.add('4', [4], 100);

		const fuck = buildingIndices[xOffset].toString();
		console.log(fuck);
		this.graphic.play(fuck);
		this.graphic.update();
	}

	update() {
		const camera = this.scene.camera;
		const scrollX = this.graphic.scrollX;
		const w = buildingW / scrollX;
		if (this.x / this.graphic.scrollX < camera.x - buildingW * scrollX) {
			console.log('left');
			this.x += buildingW * 5;
		}
		if (this.x / this.graphic.scrollX > camera.x + buildingW * 4) {
			// this.x -= buildingW * 5;
		}
	}
}

class Level extends Scene {
	constructor(engine) {
		super(engine);

		const canvasSize = new Vec2(engine.canvas.width, engine.canvas.height);
		const canvasCenter = canvasSize.scale(0.5);

		const p = new Player(canvasCenter.x, 130.0, assetManager);
		this.player = p;

		const cameraManager = new CameraManager(this.player);

		const bg2 = new Background(ASSETS.BG2_PNG, canvasSize.y, assetManager);
		const bg = new Background(ASSETS.BG_PNG, canvasSize.y, assetManager);
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
				entity.graphic = new Sprite(sprite);
				entity.graphic.scale = 0.5;
				entity.graphic.centerOO();
				console.log(entity.graphic);
				return entity;
			});

		entities[0].graphic.scrollX = 0;
		entities[1].graphic.scrollX = 0;
		entities[2].graphic.scrollX = 0.025;
		// entities[3].graphic.scrollX = 0.25;

		for (let i = 0; i < 5; ++i) {
			const buildings = new Buildings(i);
			this.addEntity(buildings);
			this.addRenderable(buildings);
		}

		// 0, 1, pyramids, sky, fg

		[
			...entities,
			// bg,
			// bg2,
			// tiles,
			p,
			cameraManager,
		].forEach((e) => {
			this.addEntity(e);
			this.addRenderable(e);
		});

		// const random = new Random(settings.seed);
		// for (var i = 0; i < 3; i++) {
		// 	const e = new Grimey(
		// 		random.float(1000),
		// 		game.canvas.height - random.float(200),
		// 		assetManager,
		// 	);

		// 	this.addEntity(e);
		// 	this.addRenderable(e);
		// }
	}

	update(input) {
		super.update(input);
		if (input.keyPressed('Escape')) {
			this.engine.popScenes();
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
	game.backgroundColor = '#101010';

	const menu = new Menu(game, Level, settings.autoLevel);
	game.pushScene(menu);

	if (settings.autoLevel) {
		menu.goToLevel();
	}

	game.render();

	initDebug(game, settings, defaultSettings);
});
assetManager.loadAssets();
