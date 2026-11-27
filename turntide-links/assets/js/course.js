(() => {
  'use strict';
  const TL = window.TL = window.TL || {};
  const point = (x, y) => ({ x, y });
  const ground = (x, y, w, h, kind = 'turf') => ({ x, y, w, h, kind });
  const rail = (x, y, w, h, kind, height) => ({ x, y, w, h, kind, height });

  TL.holes = [
    {
      id: 1, name: 'Bellhouse Bank', par: 4, tee: point(148, 235), cup: point(553, 208),
      stamp: point(475, 142), requirement: 'Bank rail',
      hint: 'Ring the brass rail along the far edge with a putt. Then play around the bellhouse to the flag.',
      land: [ground(78, 150, 205, 154), ground(170, 95, 363, 208), ground(456, 131, 187, 146),
        ground(111, 284, 147, 37, 'quay'), ground(458, 116, 81, 35, 'sand')],
      rails: [rail(202, 100, 298, 10, 'bank', 27), rail(327, 165, 47, 101, 'wall', 60)]
    },
    {
      id: 2, name: 'The Dune Lip', par: 3, tee: point(188, 227), cup: point(540, 223),
      stamp: point(432, 196), requirement: 'Clear the lip',
      hint: 'Switch to Chip and carry the pale dune lip. The far slope feeds the ball toward the green.',
      land: [ground(78, 170, 195, 122), ground(159, 129, 222, 183), ground(306, 147, 218, 156, 'sand'),
        ground(412, 136, 181, 161), ground(516, 162, 132, 116), ground(131, 279, 127, 39, 'quay')],
      rails: [rail(310, 147, 15, 156, 'lip', 10)],
      slope: { x: 333, y: 152, w: 145, h: 144, dx: 0.8, dy: 0.12 }
    },
    {
      id: 3, name: 'Pilot’s Pontoon', par: 4, tee: point(142, 226), cup: point(548, 199),
      stamp: point(385, 186), requirement: 'Work the paddle',
      hint: 'Hit the striped paddle from shore. A ball resting on the pontoon rides with it when the water transfers.',
      land: [ground(75, 170, 211, 128), ground(178, 118, 103, 87), ground(210, 119, 274, 39, 'quay'),
        ground(431, 126, 157, 156), ground(488, 157, 155, 117), ground(412, 248, 87, 45, 'sand')],
      rails: [], paddle: point(250, 226), deck: { x: 266, y: 204, w: 101, h: 45, dx: 76, dy: -37 }
    },
    {
      id: 4, name: 'Ferry Sound', par: 4, tee: point(156, 241), teeOnDeck: true, cup: point(565, 222),
      stamp: point(371, 142), requirement: 'Chart a passage', passageX: 355,
      hint: 'Roll east across a marked crossing on the high quay or low sandbar. The paddle drains a high inner basin to expose the sandbar.',
      land: [ground(75, 174, 174, 123), ground(187, 128, 67, 119), ground(214, 126, 293, 42, 'quay'),
        ground(451, 137, 109, 141), ground(498, 161, 153, 122), ground(453, 257, 71, 42, 'sand')],
      rails: [], paddle: point(206, 182), deck: { x: 133, y: 221, w: 92, h: 46, dx: 71, dy: -38 },
      sandbar: ground(244, 224, 216, 45, 'sand')
    }
  ];
})();
