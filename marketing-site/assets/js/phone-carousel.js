// Carrusel de interfaz en marco de celular — sin dependencias externas.
// Soporta múltiples instancias en la misma página (clase .phone-carousel).
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.phone-carousel').forEach(function (carousel) {
    var slides = carousel.querySelector('.phone-slides');
    var dots = carousel.querySelectorAll('.phone-dot');
    var prevBtn = carousel.querySelector('.phone-prev');
    var nextBtn = carousel.querySelector('.phone-next');
    var total = dots.length;
    var current = 0;
    var timer;

    function goTo(index) {
      current = (index + total) % total;
      slides.style.transform = 'translateX(-' + (current * 100) + '%)';
      dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
    }
    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }
    function startAutoplay() { stopAutoplay(); timer = setInterval(next, 4500); }
    function stopAutoplay() { clearInterval(timer); }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); startAutoplay(); });
    });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(); startAutoplay(); });
    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); startAutoplay(); });
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);

    goTo(0);
    startAutoplay();
  });
});
