$.fn.animateHighlight = function(duration) {
    var highlightBg = "#FFFF9C";
    var animateMs = duration || 1500;
    var originalBg = "#ffffff";
    this.stop().css("backgroundColor", highlightBg).animate({backgroundColor: originalBg}, animateMs);
};

randomFromInterval = function(from,to){
    return Math.floor(Math.random()*(to-from+1)+from);
};

String.prototype.repeat = function (num) {
  var a = [];
  a.length = num << 0 + 1;
  return a.join(this);
};
