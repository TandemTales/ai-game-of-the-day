(function(global){
  'use strict';var SB=global.SB=global.SB||{},ctx,muted=false;
  function unlock(){try{var C=global.AudioContext||global.webkitAudioContext;if(!ctx&&C)ctx=new C();if(ctx&&ctx.state==='suspended')ctx.resume().catch(function(){});}catch(e){ctx=null;}}
  function tone(freq,delay,duration,volume,type){if(!ctx||muted)return;var o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+delay;o.type=type||'sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+duration+.01);}
  function play(event){if(event==='attack'){tone(110,0,.12,.09,'triangle');tone(70,.03,.18,.07);}else if(event==='hack'||event==='won'){[220,330,440,660].forEach(function(f,i){tone(f,i*.08,.45,.07);});}else if(event==='lost'){tone(110,0,.7,.09);tone(82,.2,.8,.07);}else if(event==='rescue'||event==='heal'){tone(330,0,.3,.06);tone(440,.1,.4,.06);}else tone(event==='turn'?196:280,0,.1,.035);}
  SB.Audio={unlock:unlock,play:play,toggle:function(){muted=!muted;return muted;}};
})(window);
