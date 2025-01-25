let inspector;
let settings;

const titleOverrides = {
	seed: 'Use Seed',
};

const callbacks = {
	seed: (v) => (v ? 78493 : undefined),
};

const types = {
	showCamera: 'checkbox',
	showHitboxes: 'checkbox',
	seed: 'checkbox',
};

const camelToWords = (name) => {
	const str = name.replaceAll(/([a-z])([A-Z])/g, (...args) => {
		const [_, lower, upper] = args;
		return lower + ' ' + upper;
	});
	return str.charAt(0).toUpperCase() + str.slice(1);
};

const _createInput = (type, labelText, defaultValue, callback) => {
	const wrapper = document.createElement('div');
	wrapper.classList.add('input');

	const label = document.createElement('label');
	label.textContent = labelText;
	const input = document.createElement('input');
	input.type = type;

	const _callback = (...args) => {
		callback(...args);
		const json = JSON.stringify(settings);
		localStorage.setItem('settings', json);
	};

	switch (type) {
		case 'checkbox':
			input.addEventListener('change', (e) => {
				_callback(e.target.checked);
			});
			input.checked = defaultValue;
			break;
		default:
			throw new Error(`"${type}" is not a valid input type`);
	}

	wrapper.append(label, input);
	inspector.append(wrapper);
};

const createCheckbox = (name) => {
	const labelText = titleOverrides[name] ?? camelToWords(name);
	const defaultValue = Boolean(settings[name]);
	const callback = (v) => {
		settings[name] = callbacks[name]?.(v) ?? v;
	};
	_createInput.bind(0, 'checkbox')(labelText, defaultValue, callback);
};

const createInput = (name) => {
	const type = types[name];
	switch (type) {
		case 'checkbox':
			createCheckbox(name);
			break;
		default: {
			throw new Error(`createInput() | "${type}" (${name}) is invalid`);
		}
	}
};

export const initDebug = (game, _settings) => {
	const { canvas } = game;

	settings = _settings;

	inspector = document.createElement('div');
	inspector.classList.add('inspector');
	canvas.after(inspector);

	Object.keys(_settings).forEach(createInput);
};
