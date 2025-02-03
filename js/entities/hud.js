import { Entity } from '../canvas-lord/canvas-lord.js';
import { Sprite, GraphicList } from '../canvas-lord/graphic/index.js';
import { assetManager, ASSETS } from '../assets.js';

export class HUD extends Entity {
	constructor(player) {
		super(8, 8);

		this.player = player;
		const { maxHealth } = player;

		const graphicList = new GraphicList();

		graphicList.scrollX = 0;
		graphicList.scrollY = 0;

		const healthBlockW = 8;
		const healthP = 2;
		const healthH = 16;

		const healthBarW = healthBlockW * maxHealth + healthP * (maxHealth + 1);

		const borderSize = 1;
		this.healthBorder = Sprite.createRect(
			healthBarW + borderSize * 2,
			healthH + borderSize * 2,
			'#888',
		);
		this.healthBorder.x = -borderSize;
		this.healthBorder.y = -borderSize;
		this.healthBg = Sprite.createRect(healthBarW, healthH, 'black');
		this.healthFg = [];
		for (let i = 0; i < maxHealth; ++i) {
			const block = Sprite.createRect(
				healthBlockW,
				healthH - healthP * 2,
				'red',
			);
			block.x = healthP + i * (healthBlockW + healthP);
			block.y = healthP;
			this.healthFg.push(block);
		}

		const addGraphic = (gfx) => {
			graphicList.add(gfx);
			gfx.scrollX = 0;
			gfx.scrollY = 0;
		};

		addGraphic(this.healthBorder);
		addGraphic(this.healthBg);
		// addGraphic(this.healthFg);
		this.healthFg.forEach(addGraphic);

		this.bubbles = [];
		const bubbleSprite = assetManager.sprites.get(ASSETS.BUBBLES2_PNG);
		const maxBubbles = this.player.bubbles;
		for (let i = 0; i < maxBubbles; ++i) {
			const bubble = new Sprite(bubbleSprite);
			bubble.x = 24 * i;
			bubble.y = 24;
			this.bubbles.push(bubble);
		}

		this.bubbles.forEach(addGraphic);

		this.graphic = graphicList;

		this.update();
	}

	illuminate(sprites, count, on = 1, off = 0) {
		let i = 0;
		for (; i < count; ++i) {
			sprites[i].alpha = on;
			sprites[i].color = undefined;
		}
		for (; i < sprites.length; ++i) {
			sprites[i].alpha = off;
			sprites[i].color = undefined;
		}
	}

	update() {
		const { health } = this.player;

		const bubbles = this.player.bubbles;

		this.illuminate(this.healthFg, health, 1, 0);
		this.illuminate(this.bubbles, bubbles, 1, 0.6);

		if (this.player.invFrames) {
			this.healthFg[health].alpha = +(this.player.invFrames % 16 >= 8);
			this.healthFg[health].color = 'white';
		}
	}
}
