particlesJS('particles-js', {
    particles: {
        number: { value: 150 },
        color: { value: '#0A3871'},
        shape: { type: 'circle' },
        opacity: { value: 0.9, random: true },
        size: { value: 4, random: true },
        move: { enable: true, speed: 5, direction: 'none', random: false, straight: false, out_mode: 'out'}
    },
    interactivity: {
        events: { onhover: { enable: true, mode: 'repulse'} },
        modes: { repulse: { distance: 100, duration: 0.4 } }
    },
});