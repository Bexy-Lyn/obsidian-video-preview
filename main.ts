import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownPostProcessorContext,
} from "obsidian";

// Define the plugin settings interface
interface MyPluginSettings {
	showThumbnail: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	showThumbnail: true,
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register a markdown post processor to check for video links and display metadata
		this.registerMarkdownPostProcessor((element, context) =>
			this.processMarkdown(element, context)
		);

		// Add settings tab for user configurations
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async processMarkdown(
		element: HTMLElement,
		context: MarkdownPostProcessorContext
	) {
		// Regex to match YouTube links
		const youtubeRegex =
			/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+/g;
		const matches = element.innerHTML.match(youtubeRegex);

		if (matches) {
			for (const url of matches) {
				const metadata = await this.fetchVideoMetadata(url);
				if (metadata) {
					const prettyLink = this.createPrettyLink(metadata);
					element.innerHTML = element.innerHTML.replace(
						url,
						prettyLink.outerHTML
					);
				}
			}
		}
	}

	async fetchVideoMetadata(url: string) {
		try {
			const response = await fetch(
				`https://noembed.com/embed?url=${encodeURIComponent(url)}`
			);
			const data = await response.json();
			if (data) {
				return {
					title: data.title,
					author_name: data.author_name,
					thumbnail_url: data.thumbnail_url,
				};
			}
		} catch (error) {
			console.error("Error fetching video metadata:", error);
		}
		return null;
	}

	createPrettyLink(metadata: {
		title: string;
		author_name: string;
		thumbnail_url: string;
	}) {
		const container = document.createElement("div");
		container.classList.add("video-metadata-container");

		const titleElement = document.createElement("div");
		titleElement.classList.add("video-title");
		titleElement.textContent = metadata.title;

		const authorElement = document.createElement("div");
		authorElement.classList.add("video-author");
		authorElement.textContent = `by ${metadata.author_name}`;

		container.appendChild(titleElement);
		container.appendChild(authorElement);

		if (this.settings.showThumbnail) {
			const thumbnailElement = document.createElement("img");
			thumbnailElement.classList.add("video-thumbnail");
			thumbnailElement.src = metadata.thumbnail_url;
			container.insertBefore(thumbnailElement, titleElement);
		}

		return container;
	}
}

// Create the settings tab class
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Video Metadata Plugin Settings" });

		new Setting(containerEl)
			.setName("Show Thumbnail")
			.setDesc("Display the video thumbnail in the pretty link.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showThumbnail)
					.onChange(async (value) => {
						this.plugin.settings.showThumbnail = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
