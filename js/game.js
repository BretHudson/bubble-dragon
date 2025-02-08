import {
	Sfx,
	Game,
	Scene,
	Entity,
	Draw,
	Tileset,
} from './canvas-lord/canvas-lord.js';
import { Keys } from './canvas-lord/core/input.js';
import {
	Text,
	Sprite,
	AnimatedSprite,
	GraphicList,
} from './canvas-lord/graphic/index.js';
import { Vec2 } from './canvas-lord/math/index.js';
import { cardinalNorms } from './canvas-lord/math/misc.js';
import { Random } from './canvas-lord/util/random.js';
import { initDebug } from './debug.js';
import { Menu, MenuOptions } from './menu.js';
import {
	assetManager,
	ASSETS,
	DEPTH,
	COLLISION_TAG,
	settings,
	defaultSettings,
} from './assets.js';
import { Character } from './entities/character.js';
import { Player } from './entities/player.js';
import { Hitbox } from './entities/hitbox.js';
import { HUD } from './entities/hud.js';

import { OverlayEntity, ResultsScene } from './scenes/results-scene.js';

const minY = 200;
const maxY = 380;
const centerY = (maxY - minY) / 2 + minY;
const random = new Random(settings.seed);

let screen_min = 0.0;
let screen_max = Infinity;

const loadFont = async (name, fileName) => {
	const font = new FontFace(name, `url("${fileName}")`);
	await font.load();
	document.fonts.add(font);
};
await loadFont('Skullboy', './fonts/ChevyRay - Skullboy.ttf');
await loadFont('Skullboy Mono', './fonts/ChevyRay - Skullboy Mono.ttf');

const tileStartY = minY - 10;

class Tiles extends Entity {
	constructor(assetManager) {
		super(0, 0);

		const asset = assetManager.sprites.get(ASSETS.FLOOR_PNG);
		this.graphic = new GraphicList();
		this.depth = DEPTH.TILES;

		const { width, height } = asset;

		let s = Sprite.createRect(width * 10, 480, '#101010');
		s.x = 0;
		s.y = tileStartY;
		this.graphic.add(s);

		const xSize = 5;
		for (let i = -xSize; i <= xSize; i++) {
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

const states2anim = ['idle', 'walk', 'punch'];

class Boss extends Character {
	constructor(x, y, assetManager) {
		const callback = (name) => {
			switch (name) {
				case 'punch':
					this.postPunch();
					break;
			}
		};

		super(x, y, {
			health: 20,
			asset: assetManager.sprites.get(ASSETS.GRIMEBOSS_PNG),
			spriteW: 80,
			spriteH: 96,
			width: 40,
			height: 40,
			tag: COLLISION_TAG.CHAR,
			flipOffset: 10,
			callback,
		});

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [6, 7, 8], 8, false);
		this.graphic.add('death', [18, 19, 20], 60, false);
		this.graphic.add('stunned', [19], 30, false);

		this.graphic.play('idle');
	}

	postPunch() {
		this.graphic.play('idle');
		this.animState = -1;
	}

	update(input) {
		if (this.invFrames > 0) {
			this.friction = 0.3;
			super.update(input);
			return;
		}
		this.friction = 0.5;

		const punching = this.graphic?.currentAnimation?.name === 'punch';
		if (!punching) {
			let xx = this.scene.player.x - this.x;
			let yy = this.scene.player.y - this.y;
			let dist = Math.max(Math.abs(xx), Math.abs(yy));

			let next_state = 0;
			if (dist > 45.0) {
				const speed = 0.9;
				this.dx += Math.sign(this.scene.player.x - this.x) * speed;
				this.dy += Math.sign(this.scene.player.y - this.y) * speed;
				this.flip = this.dx ? this.dx < 0 : this.dy < 0;

				next_state = 1;
			} else {
				let xx = this.x + (this.flip ? -40.0 : 20.0);

				let e = new Hitbox(this, 1, xx, this.y, this.flip ? -1.0 : 1.0);
				this.scene.addEntity(e);
				this.hitbox = e;
				next_state = 2;
			}

			if (this.animState !== next_state) {
				this.graphic.play(states2anim[next_state]);
				this.animState = next_state;
			}

			if (this.x < this.scene.player.x - 400.0) {
				console.log('Offscreened!');
				super.onDeath();
			}
		}

		this.graphic.scaleX = this.flip ? -1.0 : 1.0;
		super.update(input);
	}
}

class Grimey extends Character {
	death_fade = 0.0;

	constructor(x, y, assetManager, enemyDirector) {
		const callback = (name) => {
			switch (name) {
				case 'punch':
					this.postPunch();
					break;
			}
		};

		super(x, y, {
			health: settings.enemyHealth,
			asset: assetManager.sprites.get(ASSETS.BADGUY_PNG),
			spriteW: 80,
			spriteH: 80,
			width: 20,
			height: 20,
			tag: COLLISION_TAG.CHAR,
			flipOffset: 10,
			points: 1,
			enemyDirector,
			callback,
		});

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 5, 6], 8, false);
		this.graphic.add('death', [12, 13, 14], 60, false);
		this.graphic.add('stuck', [14], 60, false);
	}

	postPunch() {
		this.graphic.play('idle');
		this.animState = -1;
	}

	onDeath() {
		const asset = assetManager.audio.get(ASSETS.CRUNCH);
		Sfx.play(asset);

		this.graphic.play('death');
		// TODO(bret): this.collider.collidable = false;
		this.collider = null;
	}

	update(input) {
		if (this.health === 0) {
			if (this.graphic.frame === 2) {
				this.death_fade += 0.33 / 60.0;
				this.graphic.alpha = 1.0 - this.death_fade;
				if (this.death_fade > 1.0) {
					super.onDeath();
				}
			}
			return;
		}

		if (this.bubble) {
			this.x = this.bubble.x;
			this.y = this.bubble.y;
			this.graphic.x = 0.0;
			this.graphic.y = this.bubble.graphic.y - 30.0;
			return;
		}

		if (this.target) {
			const pos = new Vec2(this.x, this.y);
			let delta = this.target.pos.sub(pos);
			if (delta.magnitude > 1) {
				delta.normalize();
			}
			// delta = delta.scale(0.5);
			this.dx = delta.x;
			this.dy = delta.y;

			// TODO(bret): revisit
			this.flip = this.dx <= 0;
		}

		super.update(input);

		return;

		const punching = this.graphic?.currentAnimation?.name === 'punch';
		if (!punching && this.target) {
			// TODO(bret): Update it so the target is relative to the player
			let xx = this.scene.player.x + this.target.x - this.x;
			let yy = this.scene.player.y + this.target.y - this.y;
			let dist = Math.max(Math.abs(xx), Math.abs(yy));

			let next_state = 0;
			if (dist > 0) {
				const speed = 0.5;
				let dx = Math.sign(this.scene.player.x - this.x) * speed;
				let dy = Math.sign(this.scene.player.y - this.y) * speed;
				this.x += this.collide(this.x + dx, this.y, [
					COLLISION_TAG.CHAR,
				])
					? 0.0
					: dx;
				this.y += this.collide(this.x, this.y + dy, [
					COLLISION_TAG.CHAR,
				])
					? 0.0
					: dy;
				this.flip = dx ? dx < 0 : dy < 0;

				next_state = 1;
			} else {
				let xx = this.x + (this.flip ? -40.0 : 20.0);

				let e = new Hitbox(this, 1, xx, this.y, this.flip ? -1.0 : 1.0);
				this.scene.addEntity(e);
				this.hitbox = e;
				next_state = 2;
			}

			if (this.animState !== next_state) {
				this.graphic.play(states2anim[next_state]);
				this.animState = next_state;
			}

			if (this.x + 400.0 < this.scene.player.x) {
				console.log('Offscreened!');
				super.onDeath();
			}
		}

		super.update(input);
	}

	render(ctx, camera) {
		// this.graphic.x = -(this.y - minY) + (this.flip ? -10 : 10);
		this.graphic.x = this.flip ? -10 : 10;
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

		if (input && settings.showCamera) {
			if (input.keyPressed?.(Keys.Q)) this.dir = -1;
			if (input.keyPressed?.(Keys.E)) this.dir = 1;
		}

		const { x, innerDist, outerDist, dir } = this;
		let forceX = x + innerDist * dir;
		let toggleX = x - outerDist * dir;
		let followX = x - innerDist * dir;
		if (dir === 1) {
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

		if (Math.sign(realFollowX - toggleX) === -dir) {
			this.dir = Math.sign(realFollowX - toggleX);
		}

		this.scene.camera.x = this.x - this.scene.engine.canvas.width * 0.5;

		if (this.scene.camera.x < screen_min) {
			this.scene.camera.x = screen_min;
		}

		if (this.scene.camera.x > screen_max - this.scene.engine.canvas.width) {
			this.scene.camera.x = screen_max - this.scene.engine.canvas.width;
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

class Skyscrapers extends Entity {
	constructor(xOffset) {
		super(xOffset * buildingW, 0);

		this.id = xOffset;

		this.graphic = new AnimatedSprite(
			assetManager.sprites.get(ASSETS.BG_SKYSCRAPERS),
			buildingW,
			540,
		);
		this.depth = DEPTH.SKYSCRAPERS;
		this.graphic.centerOO();

		this.graphic.scrollX = 0.25;

		this.graphic.add('0', [0], 1, false);
		this.graphic.add('1', [1], 1, false);
		this.graphic.add('2', [2], 1, false);
		this.graphic.add('3', [3], 1, false);
		this.graphic.add('4', [4], 1, false);

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

class Buildings extends Entity {
	constructor() {
		super(65, 60);

		const asset = assetManager.sprites.get(ASSETS.BG_FG);

		const tileW = 64;
		const tileH = 64;

		const totalWidth = [320.0, 320.0, 320.0, 320.0].reduce(
			(a, v) => a + v,
			0,
		);
		const tileset = new Tileset(
			asset,
			totalWidth * 50,
			asset.height,
			tileW,
			tileH,
		);
		this.graphic = tileset;
		this.graphic.entity = this;

		this.depth = DEPTH.BUILDINGS;

		const building1 = [0, 0, 4, 2];
		const building2 = [4, 0, 5, 2];
		const empty = [0, 6, 1, 1];

		const billboards = Array.from({ length: 8 }, (_, i) => {
			return [i % 5, 2 + Math.floor(i / 5), 1, 1];
		});

		const renderBuilding = (_x, _y, building) => {
			const [startX, startY, w, h] = building;

			for (let y = 0; y < h; ++y) {
				for (let x = 0; x < w; ++x) {
					tileset.setTile(_x + x, _y + y, startX + x, startY + y);
				}
			}
		};

		let xPos = 0;

		const baseArr = [
			empty,
			empty,
			empty,
			empty,
			empty,
			empty,
			empty,
			empty,
			building1,
			building1,
			building1,
			building1,
			building2,
			building2,
			building2,
			building2,
			...billboards,
		];

		const random = new Random(23947);
		for (let i = 0; i < 4; ++i) {
			const arr = [...baseArr];
			while (arr.length) {
				const [structure] = arr.splice(random.float(arr.length), 1);
				const [x, y, w, h] = structure;
				renderBuilding(xPos, 2 - h, structure);
				xPos += w;
			}
		}
	}
}

const pauseKeys = [Keys.Escape, Keys.P];

class PauseScreen extends Scene {
	constructor(engine) {
		super(engine);

		const { width, height } = this.engine.canvas;

		const rect = Sprite.createRect(width, height, '#101010');
		rect.alpha = 0.3;
		const rectEntity = new Entity();
		rectEntity.graphic = rect;
		this.addEntity(rectEntity);

		const yPad = 20;

		const text = new Text('PAUSED', 0, 0, { font: 'Skullboy', size: 48 });
		text.centerOO();
		const textEntity = new Entity(width >> 1, height >> 1);
		textEntity.y -= yPad * 2;
		textEntity.graphic = text;
		this.addEntity(textEntity);

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
	}
}

const dist = 60;
const offsets = cardinalNorms
	.filter(([x]) => x)
	.map(([x, y]) => {
		const xx = y ? x * dist : x * dist * 1.2;
		return new Vec2(xx, y * dist);
	});

class EnemyDirector extends Entity {
	constructor() {
		super();

		this.maxPoints = 3;

		this.cells = offsets.map((_, index) => ({
			index,
			pos: new Vec2(),
			enemy: null,
		}));

		this.depth = -Infinity;

		this.enemies = [];
	}

	updateOffsets() {
		const playerPos = new Vec2(this.player.x, this.player.y);
		for (let i = 0; i < offsets.length; ++i) {
			this.cells[i].pos = offsets[i].add(playerPos);
		}
	}

	register(character) {
		if (character.points === undefined) {
			console.log(character);
			throw new Error('Character does not have points set');
		}

		// skip the player
		if (character.points === -1) return;

		this.enemies.push(character);
	}

	unregister(character) {
		const target = this.cells.find(({ enemy }) => enemy === character);
		if (target) {
			character.target = null;
			target.enemy = null;
		}

		const index = this.enemies.indexOf(character);
		if (index > -1) {
			this.enemies.splice(index, 1);
		}
	}

	update() {
		this.updateOffsets();

		// instant KO
		const cellsToRecycle = this.cells.filter(
			({ enemy }) => enemy && enemy.isDead,
		);
		cellsToRecycle.forEach(({ enemy }) => this.unregister(enemy));

		let curPoints = this.cells
			.filter(({ enemy }) => enemy)
			.map(({ enemy }) => enemy.points)
			.reduce((a, v) => a + v, 0);
		if (curPoints >= this.maxPoints) return;

		const availableCells = this.cells.filter(({ enemy }) => !enemy);

		this.enemies.forEach((enemy) => {
			if (enemy.target) return;

			if (enemy.points > this.maxPoints - curPoints) return;

			// TODO(bret): Update available offsets!
			if (availableCells.length > 0) {
				// otherwise let's find a target
				const enemyPos = new Vec2(enemy.x, enemy.y);

				const distances = availableCells.map(
					({ pos }) => pos.sub(enemyPos).magnitude,
				);

				let minDist = Infinity;
				let minIndex;
				for (let i = 0; i < distances.length; ++i) {
					if (distances[i] < minDist) {
						minDist = distances[i];
						minIndex = i;
					}
				}

				enemy.target = availableCells[minIndex];
				availableCells[minIndex].enemy = enemy;
				availableCells.splice(minIndex, 1);
				curPoints += enemy.points;
			}
		});
	}

	render(ctx, camera) {
		const drawX = -camera.x;
		const drawY = -camera.y;

		this.cells.forEach(({ pos, enemy }, index) => {
			const { x, y } = pos;
			Draw.circle(
				ctx,
				{ type: 'fill', color: enemy ? 'lime' : 'yellow' },
				drawX + x,
				drawY + y,
				3,
			);
			Draw.text(
				ctx,
				{ type: 'fill', color: 'white' },
				drawX + x,
				drawY + y + 10,
				index.toString(),
			);
		});
	}
}

class Level extends Scene {
	constructor(engine) {
		super(engine);

		this.backgroundColor = '#101010';

		const canvasSize = new Vec2(engine.canvas.width, engine.canvas.height);
		const canvasCenter = canvasSize.scale(0.5);

		const enemyDirector = new EnemyDirector();
		this.addEntity(enemyDirector);

		const p = new Player(
			canvasCenter.x,
			centerY,
			assetManager,
			enemyDirector,
		);
		this.player = p;

		const cameraManager = new CameraManager(this.player);

		const tiles = new Tiles(assetManager);

		const entities = [ASSETS.BG_SUNSET, ASSETS.BG_CLOUD, ASSETS.BG_PYRAMIDS]
			.map((asset) => assetManager.sprites.get(asset))
			.map((sprite) => {
				const entity = new Entity(
					canvasCenter.x,
					canvasCenter.y - 80, // 80 is just a magic number lol
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
			this.addEntity(new Skyscrapers(i));
		}

		const buildings = new Buildings();
		this.addEntity(buildings);

		this.addEntities(...entities, tiles, p, cameraManager);

		// temp grimeys
		{
			const w = this.engine.canvas.width;
			const positions = [
				//
				[100, minY],
				[0, centerY],
				[100, maxY],

				[w - 100, minY],
				[w - 0, centerY],
				[w - 100, maxY],
				[w - 50, minY],
			];

			for (let i = 0; i < positions.length; ++i) {
				this.addEntity(
					new Grimey(...positions[i], assetManager, enemyDirector),
				);
			}
		}

		const hud = new HUD(this.player);
		this.addEntity(hud);

		// a lil' cheat for making the camera immediately snap
		for (let i = 0; i < 100; ++i) cameraManager.update({});
	}

	furthest_room = 0;
	room_start = 0.0;
	rooms = [320.0, 320.0, 320.0, 320.0];

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

		if (this.player.isDead) {
			this.engine.pushScene(
				new ResultsScene(this.engine, 'Game Over', false),
			);
		}

		if (this.boss?.isDead) {
			this.engine.pushScene(
				new ResultsScene(this.engine, 'Game Complete', false),
			);
		}

		const dist = this.player.x - this.room_start;
		if (
			this.furthest_room < this.rooms.length &&
			dist > this.rooms[this.furthest_room]
		) {
			if (this.furthest_room === this.rooms.length - 1) {
				this.room_start += this.rooms[this.furthest_room++];
				screen_min = this.room_start;
				screen_max = this.room_start + this.engine.canvas.width;

				const e = new OverlayEntity(
					this.engine.canvas.width,
					this.engine.canvas.height,
					{
						Boss,
						Grimey,
					},
				);
				this.addEntity(e);
			} else {
				// this.room_start += this.rooms[this.furthest_room++];
				// if (this.furthest_room === this.rooms.length - 1) {
				// 	screen_max =
				// 		this.room_start + this.rooms[this.furthest_room];
				// }
				// const n = random.int(3) + 2;
				// console.log('Spawning ' + n + ' grimeys');
				// for (let i = 0; i < n; i++) {
				// 	const e = new Grimey(
				// 		this.room_start +
				// 			game.canvas.width * 0.5 +
				// 			random.int(4) * 35.0,
				// 		game.canvas.height - (i * 30.0 + 20.0),
				// 		assetManager,
				// 	);
				// 	this.addEntity(e);
				// }
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
				e.renderCollider(ctx, camera);
			});
		}
	}
}

let game;
Object.values(ASSETS).forEach((asset) => {
	switch (true) {
		case asset.endsWith('.png'):
			assetManager.addImage(asset);
			break;
		case asset.endsWith('.mp3'):
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
		assetManager,
		devMode: window.debugEnabled,
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
