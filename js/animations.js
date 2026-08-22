// ══════════════════════════════════════════════════════
// ANVIKSHIKI NEXUS — Scroll & Motion Behaviour
// IntersectionObserver-driven reveal animations, nav shrink
// ══════════════════════════════════════════════════════

  // Scroll reveal
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e,i){
      if(e.isIntersecting) setTimeout(function(){e.target.classList.add('vis');},i*70);
    });
  },{threshold:0.1});
  document.querySelectorAll('.rv').forEach(function(el){obs.observe(el);});

  // Environmental Storytelling — PROOF OF CONCEPT (Vision section only)
  var storyObs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('story-in'); storyObs.unobserve(e.target); }
    });
  },{threshold:0.2});
  (function(){
    var visionEl = document.getElementById('vision');
    if(visionEl) storyObs.observe(visionEl);
  })();



  // Card stagger delays
  document.querySelectorAll('.srv2-card,.comp-card,.pillar,.edu-card,.c-card').forEach(function(el,i){
    el.style.transitionDelay=(i%4)*.08+'s';
  });

  // Nav shrink on scroll
  window.addEventListener('scroll',function(){
    var nav=document.getElementById('nav');
    if(window.scrollY>80) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });
