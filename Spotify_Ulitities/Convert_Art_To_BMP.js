const Jimp = require('jimp');

async function saveAlbumArtBMP() {
    try {
        const image = await Jimp.read('./current_album_art.jpg');

        await image.writeAsync('./current_album_art.bmp'); 

        console.log('Saved BMP');
    } catch (error) {
        console.error('Error converting to BMP:', error);
    }
}

module.exports = { saveAlbumArtBMP }