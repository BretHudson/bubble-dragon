import { Entity } from '../canvas-lord/canvas-lord.js';
import { Sprite, GraphicList } from '../canvas-lord/graphic/index.js';
import { assetManager, ASSETS } from '../assets.js';

export class HUD extends Entity {
	constructor(player) {
		super(8, 8);

		this.player = player;

		const graphicList = new GraphicList();

		graphicList.scrollX = 0;
		graphicList.scrollY = 0;

		const healthW = 100;
		const healthH = 16;

		const borderSize = 1;
		this.healthBorder = Sprite.createRect(
			healthW + borderSize * 2,
			healthH + borderSize * 2,
			'#888',
		);
		this.healthBorder.x = -borderSize;
		this.healthBorder.y = -borderSize;
		this.healthBg = Sprite.createRect(healthW, healthH, 'black');
		this.healthFg = Sprite.createRect(healthW, healthH, 'red');

		const addGraphic = (gfx) => {
			graphicList.add(gfx);
			gfx.scrollX = 0;
			gfx.scrollY = 0;
		};

		addGraphic(this.healthBorder);
		addGraphic(this.healthBg);
		addGraphic(this.healthFg);

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

	update() {
		const { health, maxHealth } = this.player;
		const healthPercent = health / maxHealth;

		const bubbles = this.player.bubbles;

		this.healthFg.scaleX = healthPercent;

		let i = 0;
		for (; i < bubbles; ++i) {
			this.bubbles[i].alpha = 1;
		}
		for (; i < this.bubbles.length; ++i) {
			this.bubbles[i].alpha = 0.6;
		}
	}
}
