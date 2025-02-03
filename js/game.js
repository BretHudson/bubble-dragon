import {
	AssetManager,
	Sfx,
	Game,
	Scene,
	Entity,
	Draw,
	Tileset,
} from './canvas-lord/canvas-lord.js';
import { BoxCollider } from './canvas-lord/collider/index.js';
import { Keys } from './canvas-lord/core/input.js';
import {
	Text,
	Sprite,
	AnimatedSprite,
	GraphicList,
} from './canvas-lord/graphic/index.js';
import { Vec2 } from './canvas-lord/math/index.js';
import { Random } from './canvas-lord/util/random.js';
import { initDebug } from './debug.js';
import { Menu, MenuOptions } from './menu.js';
import { ASSETS } from './assets.js';

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
	enemyHealth: 6,
};
let localStorageSettings = {};
if (window.debugEnabled) {
	localStorageSettings = JSON.parse(localStorage.getItem('settings')) ?? {};
}
const settings = Object.assign({}, defaultSettings, localStorageSettings);

const minY = 200;
const maxY = 380;
const centerY = (maxY - minY) / 2 + minY;
const random = new Random(settings.seed);

let screen_min = 0.0;
let screen_max = Infinity;

let over = false;

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

const DEPTH = {
	BACKGROUND: 1000,
	SKYSCRAPERS: 100,
	TILES: 10,
	BUILDINGS: 9,
	OVERLAY: -1000,
	CAMERA: -Infinity,
};

const COLLISION_TAG = {
	BUBBLE: 'BUBBLE',
	CHAR: 'CHAR',
	HITBOX: 'HITBOX',
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
		// TODO(bret): CircleCollider?
		// yes i moved it slightly down on purpose
		this.collider = new BoxCollider(40, 40, -20, -20);
		this.collider.tag = COLLISION_TAG.BUBBLE;
	}

	update(input) {
		this.t += 10.0 / 60.0;

		this.x += this.dir * 1.5;
		this.graphic.y = Math.sin(this.t * 0.5) * 8.0 - 50.0;

		let view_x = this.x - this.scene.camera.x;
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
			return;
		}

		if (!this.caught) {
			// if an enemy gets caught by a bubble we wanna drag them with it
			const e = this.collideEntity(this.x, this.y, [COLLISION_TAG.CHAR]);
			if (e != null && e != this.owner && !e.bubble) {
				if (e instanceof Boss) {
					e.animState = -1;
					e.dx = 20.0 * this.dir;
					e.hurt(1);
					e.graphic.play('stunned');
					this.caught = e;

					Sfx.play(assetManager.audio.get(ASSETS.POP));
					this.scene.removeRenderable(this);
					this.scene.removeEntity(this);
					this.scene = null;
				} else if (e instanceof Grimey) {
					e.bubble = this;
					e.hurt(1);
					e.animState = -1;
					e.graphic.scale = 0.4;
					e.graphic.play('stuck');
					this.caught = e;
				}
			}
		}
	}
}

class CoolScreen extends Entity {
	fade = 0.0;
	boss_txt = false;

	constructor(txt, w, h, boss_txt) {
		super(w / 2, h / 2);
		this.boss_txt = boss_txt;

		this.graphic = new GraphicList();

		this.bg = Sprite.createRect(w, h, 'black');
		this.bg.centerOrigin();
		this.bg.scrollX = 0.0;
		this.graphic.add(this.bg);

		this.txt = new Text(txt, 0, 0, {
			font: 'Skullboy',
			size: 32,
		});
		this.txt.scrollX = 0.0;
		this.txt.centerOrigin();
		this.graphic.add(this.txt);
		this.depth = DEPTH.OVERLAY;
	}

	update(input) {
		this.fade += 1.0 / 60.0;
		if (this.fade > 1.0) {
			this.fade = 1.0;

			if (this.boss_txt) {
				screen_min = this.scene.room_start;
				screen_max = this.scene.room_start + 400.0;

				const e = new Boss(
					this.scene.room_start +
						this.scene.engine.canvas.width * 0.5,
					this.scene.engine.canvas.height * 0.5,
					assetManager,
				);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);

				const n = this.scene.entities.inScene.length;
				for (let i = 0; i < n; ++i) {
					const e = this.scene.entities.inScene[i];
					if (e instanceof Grimey) {
						this.scene.removeRenderable(e);
						this.scene.removeEntity(e);
						e.scene = null;
					}
				}

				// kill overlay
				this.scene.removeRenderable(this);
				this.scene.removeEntity(this);
				this.scene = null;
			} else {
				if (input.keyPressed(pauseKeys)) {
					this.scene.engine.popScenes();
				}
			}
		}

		if (this.boss_txt) {
			this.bg.alpha = Math.sin(this.fade * Math.PI) * 0.5 + 0.5;
		} else {
			this.bg.alpha = this.fade;
		}

		this.visible = !settings.hideOverlay;
	}
}

const invincibilityDuration = 30;
class Character extends Entity {
	invFrames = 0;
	health = 10;

	animState = 0;
	hitbox = null;

	dx = 0;
	dy = 0;

	flipOffset = 0;
	friction = 0.5;

	constructor(
		x,
		y,
		{ health, asset, spriteW, spriteH, width, height, tag, flipOffset },
	) {
		super(x, y);

		this.maxHealth = health;
		this.health = this.maxHealth;

		if (width && height) {
			// TODO(bret): CircleCollider? (or maybe Ellipsis??)
			this.collider = new BoxCollider(
				width,
				height,
				-width * 0.5,
				-height * 0.5 - 10,
			);
			this.collider.tag = tag ?? COLLISION_TAG.CHAR;
		}

		if (asset) {
			this.graphic = new AnimatedSprite(asset, spriteW, spriteH);
			this.graphic.centerOO();
			this.graphic.originY = 0;
			this.graphic.offsetY = 0;
			this.graphic.y = -this.graphic.frameH;
		}

		this.flipOffset = flipOffset;
	}

	updateGraphic() {
		this.graphic.scaleX = this.flip ? -1.0 : 1.0;
		this.graphic.x = this.flip ? -this.flipOffset : this.flipOffset;
	}

	onDeath() {
		this.scene.removeRenderable(this);
		this.scene.removeEntity(this);
		this.scene = null;
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
		this.invFrames = invincibilityDuration;
		this.updateHitFlash();
		return true;
	}
	
	updateHitFlash() {
		if (this.health <= 0) {
			this.hitFlash = false;
			return;
		}
		this.hitFlash = this.invFrames && (this.invFrames % 16 >= 8);
	}

	update(input) {
		super.update(input);

		if (this.scene == null) {
			return; // we just died
		}

		// friction
		this.dx -= this.dx * this.friction;
		this.dy -= this.dy * this.friction;

		if (!(this instanceof Player)) {
			this.x += this.collide(this.x + this.dx, this.y, COLLISION_TAG.CHAR)
				? 0.0
				: this.dx;
			this.y += this.collide(this.x, this.y + this.dy, COLLISION_TAG.CHAR)
				? 0.0
				: this.dy;
		} else {
			this.x += this.dx;
			this.y += this.dy;
		}
		this.x = Math.clamp(this.x, screen_min - 100.0, screen_max + 20.0);
		this.y = Math.clamp(this.y, minY, maxY);

		this.depth = -this.y;
		this.updateGraphic();

		if (this.invFrames > 0) {
			this.invFrames -= 1;
		}

		this.updateHitFlash();
	}

	render(ctx, camera) {
		const drawX = this.x - camera.x;
		const drawY = this.y - camera.y;
		
		Draw.text(ctx, { type: 'fill', color: 'white' }, drawX, drawY, this.invFrames.toString());

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
			drawX - r * 2,
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
	dir = 0;

	constructor(o, d, x, y, dir) {
		super(x, y);
		this.dir = dir;
		this.dmg = d;
		this.owner = o;
		this.collider = new BoxCollider(20, 60, 0, -30);
		this.collider.tag = COLLISION_TAG.HITBOX;

		this.time = 30;
	}

	update(input) {
		this.collider.collidable = this.owner.graphic.frameId === 5;
		
		if (this.collider.collidable) {
			const ents = this.collideEntities(this.x, this.y, [
				COLLISION_TAG.CHAR,
			]);
			ents.forEach((e) => {
				if (e != null && e != this.owner && e instanceof Character) {
					if (e.hurt(this.dmg)) {
						if (e.health == 0) {
							e.dx = 30.0 * this.dir;
							e.friction = 0.2;
						}

						const asset = assetManager.audio.get(
							random.choose(punch_sfx),
						);
						Sfx.play(asset);
					}
				}
			});
		}

		this.time -= 1;
		if (this.time == 0) {
			this.scene.removeRenderable(this);
			this.scene.removeEntity(this);
			this.scene = null;
		}
	}
}

const keysU = [Keys.W, Keys.ArrowUp];
const keysD = [Keys.S, Keys.ArrowDown];
const keysL = [Keys.A, Keys.ArrowLeft];
const keysR = [Keys.D, Keys.ArrowRight];

const states2anim = ['idle', 'walk', 'punch'];

class Player extends Character {
	flip = false;

	bubble_ticks = 0;
	bubbles = 3;

	constructor(x, y, assetManager) {
		super(x, y, {
			health: 10,
			asset: assetManager.sprites.get(ASSETS.MRCLEAN_PNG),
			spriteW: 80,
			spriteH: 80,
			width: 20,
			height: 20,
			tag: COLLISION_TAG.CHAR,
			flipOffset: 10,
		});
		
		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 5, 6], 8, false);
	}

	onDeath() {
		if (!over) {
			let e = new CoolScreen(
				'GAME OVER!',
				this.scene.engine.canvas.width,
				this.scene.engine.canvas.height,
				false,
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

		if (settings.invincible) this.health = this.maxHealth;

		if (this.bubbles < 3) {
			this.bubble_ticks += 1;
			if (this.bubble_ticks > 120) {
				this.bubbles += 1;
				this.bubble_ticks = 0;
			}
		}

		let walking = false;
		let next_state = 0;
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

			if (input.keyPressed(Keys.Z) && this.bubbles > 0) {
				this.bubbles -= 1;
				this.bubble_ticks = 0;

				let e = new BubbleTrap(this.x, this.y, this.flip ? -1.0 : 1.0);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);
			}

			if (input.keyPressed(Keys.Space)) {
				let xx = this.x + (this.flip ? -40.0 : 20.0);
				
				let e = new Hitbox(this, 2, xx, this.y, this.flip ? -1.0 : 1.0);
				e.collider.collidable = false;
				this.scene.addEntity(e);
				this.scene.addRenderable(e);
				this.hitbox = e;
				next_state = 2;
			}

			if (this.animState != next_state) {
				this.graphic.play(states2anim[next_state]);
				this.animState = next_state;
			}
		}

		super.update(input);
	}

	render(ctx, camera) {
		// this.graphic.x = -(this.y - minY);
		this.graphic.x = this.flip ? -10 : 10;

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

		for (let i = 0; i < this.bubbles; i++) {
			Draw.image(ctx, imageOptions, 8.0 + i * 32.0, 32.0);
		}
	}
}

class Boss extends Character {
	constructor(x, y, assetManager) {
		super(x, y, {
			health: 20,
			asset: assetManager.sprites.get(ASSETS.GRIMEBOSS_PNG),
			spriteW: 80,
			spriteH: 96,
			width: 40,
			height: 40,
			tag: COLLISION_TAG.CHAR,
			flipOffset: 10,
		});

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [6, 7, 8], 8, false);
		this.graphic.add('death', [18, 19, 20], 60, false);
		this.graphic.add('stunned', [19], 30, false);

		this.graphic.play('idle');
	}

	onDeath() {
		if (!over) {
			let e = new CoolScreen(
				'YOU WON!',
				this.scene.engine.canvas.width,
				this.scene.engine.canvas.height,
				false,
			);
			this.scene.addEntity(e);
			this.scene.addRenderable(e);

			over = true;
		}

		super.onDeath();
	}

	update(input) {
		if (this.invFrames > 0) {
			this.friction = 0.3;
			super.update(input);
			return;
		}
		this.friction = 0.5;

		if (this.hitbox !== null) {
			// hitbox died, we can hit again
			if (!this.hitbox.scene) {
				this.hitbox = null;
			}
		} else {
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
				this.scene.addRenderable(e);
				this.hitbox = e;
				next_state = 2;
			}

			if (this.animState != next_state) {
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

	constructor(x, y, assetManager) {
		super(x, y, {
			health: settings.enemyHealth,
			asset: assetManager.sprites.get(ASSETS.BADGUY_PNG),
			spriteW: 80,
			spriteH: 80,
			width: 20,
			height: 20,
			tag: COLLISION_TAG.CHAR,
			flipOffset: 10,
		});

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 5, 6], 8, false);
		this.graphic.add('death', [12, 13, 14], 60, false);
		this.graphic.add('stuck', [14], 60, false);
	}

	onDeath() {
		const asset = assetManager.audio.get(ASSETS.CRUNCH);
		Sfx.play(asset);

		this.graphic.play('death');
		// TODO(bret): this.collider.collidable = false;
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
			this.graphic.x = 0.0;
			this.graphic.y = this.bubble.graphic.y - 30.0;
			return;
		}

		if (this.hitbox) {
			// hitbox died, we can hit again
			if (!this.hitbox.scene) {
				this.animState = -1;
				this.hitbox = null;
			}
		} else {
			let xx = this.scene.player.x - this.x;
			let yy = this.scene.player.y - this.y;
			let dist = Math.max(Math.abs(xx), Math.abs(yy));

			let next_state = 0;
			if (dist > 45.0) {
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
				this.scene.addRenderable(e);
				this.hitbox = e;
				next_state = 2;
			}

			if (this.animState != next_state) {
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
		this.addRenderable(rectEntity);

		const yPad = 20;

		const text = new Text('PAUSED', 0, 0, { font: 'Skullboy', size: 48 });
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
			const skyscrapers = new Skyscrapers(i);
			this.addEntity(skyscrapers);
			this.addRenderable(skyscrapers);
		}

		const buildings = new Buildings();
		this.addEntity(buildings);
		this.addRenderable(buildings);

		[...entities, tiles, p, cameraManager].forEach((e) => {
			this.addEntity(e);
			this.addRenderable(e);
		});

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
		// TODO(bret): might want to revisit this
		if (over) return;

		this.engine.pushScene(new PauseScreen(this.engine));
	}

	update(input) {
		super.update(input);

		if (input.keyPressed(pauseKeys)) {
			this.pauseGame();
		}

		const dist = this.player.x - this.room_start;
		if (
			this.furthest_room < this.rooms.length &&
			dist > this.rooms[this.furthest_room]
		) {
			if (this.furthest_room == this.rooms.length - 1) {
				this.room_start += this.rooms[this.furthest_room++];
				screen_min = this.room_start;
				screen_max = this.room_start + this.engine.canvas.width;

				const e = new CoolScreen(
					'BOSS TIME!',
					this.engine.canvas.width,
					this.engine.canvas.height,
					true,
				);
				this.addEntity(e);
				this.addRenderable(e);
			} else {
				this.room_start += this.rooms[this.furthest_room++];
				if (this.furthest_room == this.rooms.length - 1) {
					screen_max =
						this.room_start + this.rooms[this.furthest_room];
				}

				const n = random.int(3) + 2;
				console.log('Spawning ' + n + ' grimeys');

				for (let i = 0; i < n; i++) {
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
				e.renderCollider(ctx, camera);
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
