import { uploadFile, uploadPublicImage } from '../helpers/uploadHelpers';

describe('uploadPublicImage', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test('posts multipart file and returns URL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: 'https://cdn.example.com/a.jpg' }),
    });

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const url = await uploadPublicImage(file);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/uploads',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(url).toBe('https://cdn.example.com/a.jpg');
  });

  test('rejects non-image files', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });

    await expect(uploadPublicImage(file)).rejects.toThrow(/image/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('uploadFile returns object shape expected by profile UI', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: 'https://cdn.example.com/p.jpg' }),
    });

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const result = await uploadFile(file);

    expect(result).toEqual({ url: 'https://cdn.example.com/p.jpg' });
  });

  test('surfaces API errors', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ error: 'No file provided' }),
    });

    const file = new File(['x'], 'a.png', { type: 'image/png' });

    await expect(uploadPublicImage(file)).rejects.toThrow(/No file provided/);
  });
});
