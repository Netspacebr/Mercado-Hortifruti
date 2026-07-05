const IMGUR_API_URL = 'https://api.imgur.com/3/upload';

/**
 * Uploads an image file to Imgur using the anonymous API.
 * @param file The image file to upload.
 * @param clientId The Imgur application Client ID.
 * @returns A promise that resolves to the URL of the uploaded image.
 */
export const uploadImageToImgur = async (file: File, clientId: string): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(IMGUR_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Client-ID ${clientId}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        // Imgur API returns error details in `data.error`
        const errorMessage = errorData?.data?.error || `HTTP error! status: ${response.status}`;
        throw new Error(`Falha no upload para o Imgur: ${errorMessage}`);
    }

    const result = await response.json();
    
    if (result.success && result.data.link) {
        return result.data.link;
    } else {
        throw new Error('A resposta da API do Imgur não foi bem-sucedida ou não continha um link.');
    }
};
