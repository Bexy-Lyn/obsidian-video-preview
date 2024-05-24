import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownPostProcessorContext,
	Notice,
} from "obsidian";

interface VideoPluginSettings {
	showThumbnail: boolean;
	showChannelIcon: boolean;
	apiKey: string;
}

const DEFAULT_SETTINGS: VideoPluginSettings = {
	showThumbnail: true,
	showChannelIcon: true,
	apiKey: "",
};

export default class VideoPlugin extends Plugin {
	settings: VideoPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor((element, context) =>
			this.processMarkdown(element, context)
		);

		this.addSettingTab(new VideoPlugnSettings(this.app, this));
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
		// Validate API key if Channel Icon is enabled
		if (this.settings.showChannelIcon && !this.settings.apiKey) {
			new Notice("API Key is required when Channel Icon is enabled.");
			return;
		}
		await this.saveData(this.settings);
	}

	async processMarkdown(
		element: HTMLElement,
		context: MarkdownPostProcessorContext
	) {
		const anchorTags = element.querySelectorAll<HTMLAnchorElement>("a");
		const anchorArray = Array.from(anchorTags);
		for (const anchor of anchorArray) {
			const url = anchor.getAttribute("href");
			if (url && this.isYouTubeUrl(url)) {
				const metadata = await this.fetchVideoMetadata(url);
				if (metadata) {
					const prettyLink = await this.createPrettyLink(metadata);
					anchor.replaceWith(prettyLink);
				}
			}
		}
	}

	isYouTubeUrl(url: string): boolean {
		const youtubeRegex = /https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+/;
		return youtubeRegex.test(url);
	}

	async fetchVideoMetadata(url: string) {
		try {
			const response = await fetch(
				`https://noembed.com/embed?url=${encodeURIComponent(url)}`
			);
			const data = await response.json();
			if (data) {
				const channelIconUrl = this.settings.showChannelIcon
					? await this.fetchChannelIcon(data.author_url)
					: null;
				return {
					title: data.title,
					author_name: data.author_name,
					thumbnail_url: data.thumbnail_url,
					url: url,
					channel_icon_url: channelIconUrl,
				};
			}
		} catch (error) {
			console.error("Error fetching video metadata:", error);
		}
		return null;
	}

	async fetchChannelIcon(channelUrl: string) {
		try {
			const channelId = await this.getChannelIdFromUrl(channelUrl);
			const response = await fetch(
				`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${this.settings.apiKey}`
			);
			const data = await response.json();
			if (data.items && data.items.length > 0) {
				return data.items[0].snippet.thumbnails.default.url;
			}
		} catch (error) {
			console.error("Error fetching channel icon:", error);
		}
		return null;
	}

	async getChannelIdFromUrl(customUrl: string): Promise<string | null> {
		// Define the endpoint URL
		const url =
			"https://www.googleapis.com/youtube/v3/search?part=snippet&q=" +
			customUrl +
			"&type=channel&key=" +
			this.settings.apiKey;

		try {
			// Make the request to the API
			const response = await fetch(url);

			// Check if the channel information is available
			const data = await response.json();
			if (data.items && data.items.length > 0) {
				// Extract the channel ID
				const channelId = data.items[0].snippet.channelId;
				return channelId;
			} else {
				return null;
			}
		} catch (error) {
			console.error("Error fetching channel ID:", error);
			return null;
		}
	}

	async createPrettyLink(metadata: {
		title: string;
		author_name: string;
		thumbnail_url: string;
		url: string;
		channel_icon_url: string | null;
	}) {
		const container = document.createElement("a");
		container.classList.add("video-metadata-container");

		container.href = metadata.url;
		container.target = "_blank";

		container.rel = "noopener noreferrer";

		if (this.settings.showThumbnail) {
			const thumbnailElement = document.createElement("img");
			thumbnailElement.classList.add("video-thumbnail");
			thumbnailElement.src = metadata.thumbnail_url;
			container.appendChild(thumbnailElement);
		}

		const banner = document.createElement("div");
		banner.classList.add("banner");

		const textContainer = document.createElement("div");
		textContainer.classList.add("video-text-container");

		const titleElement = document.createElement("strong");
		titleElement.textContent = metadata.title;
		textContainer.appendChild(titleElement);

		const authorNameElement = document.createElement("span");
		authorNameElement.textContent = metadata.author_name;
		textContainer.appendChild(authorNameElement);

		if (metadata.channel_icon_url) {
			const channelImage = document.createElement("img");
			channelImage.classList.add("channel-icon");
			channelImage.src = metadata.channel_icon_url;
			banner.appendChild(channelImage);
		}

		banner.appendChild(textContainer);
		container.appendChild(banner);

		return container;
	}
}

class VideoPlugnSettings extends PluginSettingTab {
	plugin: VideoPlugin;

	private apiKeySetting: Setting | null;

	constructor(app: App, plugin: VideoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.apiKeySetting = null;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Video Preview Settings" });

		new Setting(containerEl)
			.setName("Thumbnail")
			.setDesc("Show the thumbnail of the video.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showThumbnail)
					.onChange(async (value) => {
						this.plugin.settings.showThumbnail = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Channel Icon")
			.setDesc(
				"Display the channel icon in the video banner. This needs an YouTube Data V3 API Key to work."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showChannelIcon)
					.onChange(async (value) => {
						this.plugin.settings.showChannelIcon = value;
						this.toggleApiKeySetting(value);
						await this.plugin.saveSettings();
					});
			});

		this.apiKeySetting = new Setting(containerEl)
			.setName("YouTube Data API Key")
			.setDesc("Enter your YouTube Data API key.")
			.addText((text) => {
				text.setPlaceholder("Enter API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
			});

		this.toggleApiKeySetting(this.plugin.settings.showChannelIcon);
	}

	toggleApiKeySetting(visible: boolean) {
		if (this.apiKeySetting) {
			this.apiKeySetting.settingEl.style.display = visible
				? "block"
				: "none";
		}
	}
}
