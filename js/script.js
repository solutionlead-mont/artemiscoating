
const track = document.querySelector(".certificates-track");

if (track) {
    let position = 0;
    let previousTime = 0;
    const speed = 40; // pixels per second
    const gap = 30;

    function animate(time) {
        if (previousTime === 0) previousTime = time;

        const delta = (time - previousTime) / 1000;
        previousTime = time;

        const firstImage = track.firstElementChild;

        if (!firstImage) return;

        position += speed * delta;

        const distance = firstImage.offsetWidth + gap;

        if (position >= distance) {
            position -= distance;
            track.appendChild(firstImage);
        }

        track.style.transform = `translateX(-${position}px)`;

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}
