import {
	AssetManager,
	Sfx,
	Game,
	Scene,
	Entity,
	Draw,
	Tileset,
} from '../canvas-lord/canvas-lord.js';
import { BoxCollider } from '../canvas-lord/collider/index.js';
import { Keys } from '../canvas-lord/core/input.js';
import {
	Text,
	Sprite,
	AnimatedSprite,
	GraphicList,
} from '../canvas-lord/graphic/index.js';
import { Vec2 } from '../canvas-lord/math/index.js';
import { Random } from '../canvas-lord/util/random.js';
import { initDebug } from '../debug.js';
import { Menu, MenuOptions } from '../menu.js';
import {
	assetManager,
	ASSETS,
	DEPTH,
	COLLISION_TAG,
	punch_sfx,
	settings,
} from '../assets.js';
import { Character } from './character.js';
import { Hitbox } from './hitbox.js';
import { BubbleTrap } from './bubble-trap.js';

const keysU = [Keys.W, Keys.ArrowUp];
const keysD = [Keys.S, Keys.ArrowDown];
const keysL = [Keys.A, Keys.ArrowLeft];
const keysR = [Keys.D, Keys.ArrowRight];

const states2anim = ['idle', 'walk', 'punch'];

export class Player extends Character {
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

		this.ignoreCollisions = true;

		this.graphic.add('idle', [0], 60);
		this.graphic.add('walk', [0, 1, 2, 3], 20);
		this.graphic.add('punch', [4, 5, 5, 5, 6], 8, false, () => {
			this.postPunch();
		});
	}

	postPunch() {
		this.graphic.play('idle');
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
		const punching = this.graphic?.currentAnimation?.name === 'punch';
		if (!punching) {
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
			// TODO(bret): uncomment this
			// this.y = Math.clamp(this.y, minY, maxY);

			if (input.keyPressed(Keys.Z) && this.bubbles > 0) {
				this.bubbles -= 1;
				this.bubble_ticks = 0;

				let e = new BubbleTrap(
					this.x,
					this.y,
					this.flip ? -1.0 : 1.0,
					assetManager,
				);
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

			if (this.animState !== next_state) {
				this.graphic.play(states2anim[next_state]);
				this.animState = next_state;
			}
		}

		super.update(input);
	}
}
