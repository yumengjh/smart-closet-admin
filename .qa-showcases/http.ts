declare global {
  interface Window {
    qaCalls: unknown[];
    qaConflict: boolean;
    qaMissingLabel: boolean;
    qaImageDelayMs: number;
    qaPendingImageReleases: Array<() => void>;
    qaImageResponses: number;
    qaReleasePendingImages: () => void;
  }
}

let items = [
  {
    id: "official-1",
    title: "官方示意素材",
    description: "本地协议与交互验收",
    sortOrder: 0,
    status: "DRAFT",
    revision: 0,
    sourceNote: "运营专门制作的可公开测试素材",
    hash: "test-hash",
    width: 240,
    height: 320,
    aiGenerated: true,
    imageUrl: "/ignored",
    createdAtMs: 1,
    updatedAtMs: 1
  }
];
window.qaCalls = [];
window.qaConflict = false;
window.qaMissingLabel = false;
window.qaImageDelayMs = 0;
window.qaPendingImageReleases = [];
window.qaImageResponses = 0;
window.qaReleasePendingImages = () => {
  [...window.qaPendingImageReleases].forEach(release => release());
};

export const http = {
  request: async (method: string, url: string, options: any = {}) => {
    window.qaCalls.push({
      method,
      url,
      data:
        options.data instanceof FormData
          ? [...options.data.keys()]
          : options.data
    });
    const data = options.data;
    if (url.endsWith("/image")) {
      const delay = window.qaImageDelayMs;
      if (delay > 0)
        await new Promise<void>(resolve => {
          let timer: ReturnType<typeof setTimeout>;
          let cancel: () => void;
          const release = () => {
            window.qaPendingImageReleases =
              window.qaPendingImageReleases.filter(
                pending => pending !== cancel
              );
            resolve();
          };
          cancel = () => {
            clearTimeout(timer);
            release();
          };
          timer = setTimeout(release, delay);
          window.qaPendingImageReleases.push(cancel);
        });
      const blob = new Blob(
        [await (await fetch("/fixture.png")).arrayBuffer()],
        {
          type: "image/png"
        }
      );
      window.qaImageResponses++;
      return blob;
    }
    if (method === "get")
      return {
        data: {
          items: structuredClone(items),
          total: items.length,
          page: 0,
          size: 20
        }
      };
    if (window.qaConflict) {
      window.qaConflict = false;
      items[0].revision++;
      throw { response: { status: 409, data: { message: "revision" } } };
    }
    if (url.endsWith("/uploads")) {
      if (window.qaMissingLabel)
        throw {
          response: {
            status: 400,
            data: { message: "图片缺少可信 AI 生成隐式标识" }
          }
        };
      return {
        data: { uploadId: "upload-1", hash: "hash", width: 240, height: 320 }
      };
    }
    if (url.endsWith("/publish")) {
      items[0].status = "PUBLISHED";
      items[0].revision++;
      return { data: items[0] };
    }
    if (url.endsWith("/retire")) {
      items[0].status = "RETIRED";
      items[0].revision++;
      return { data: items[0] };
    }
    if (method === "put") {
      Object.assign(items[0], data, {
        status: "DRAFT",
        revision: items[0].revision + 1
      });
      return { data: items[0] };
    }
    const row = {
      ...items[0],
      ...data,
      id: "official-2",
      status: "DRAFT",
      revision: 0
    };
    items.push(row);
    return { data: row };
  }
};
