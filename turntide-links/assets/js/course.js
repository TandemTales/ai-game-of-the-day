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
    },
    {
      id: 5, island: 'Orchard Steps', name: 'Windfall Return', par: 4,
      tee: point(128, 277), cup: point(506, 139), stamp: point(433, 205),
      requirement: 'Climb the return ramp',
      hint: 'Putt east through the stone ramp. Its curved exit feeds the middle terrace. From there, turn uphill to the flag.',
      land: [ground(66, 232, 192, 104), ground(140, 207, 113, 89),
        ground(238, 241, 146, 57, 'quay'), ground(363, 193, 128, 113),
        ground(406, 148, 108, 91), ground(455, 100, 163, 99),
        ground(466, 240, 42, 38, 'sand')],
      rails: [], ramp: ground(245, 245, 125, 48, 'quay')
    },
    {
      id: 6, island: 'Orchard Steps', name: 'The Cider Lighter', par: 4,
      tee: point(137, 307), cup: point(553, 125), stamp: point(365, 202),
      requirement: 'Land on the raised barge',
      hint: 'Float the fruit barge into the gap with the paddle. When it is high, chip onto its deck and come to rest aboard.',
      land: [ground(65, 255, 179, 102), ground(122, 196, 119, 117),
        ground(201, 261, 49, 54, 'quay'), ground(445, 140, 99, 87),
        ground(481, 87, 151, 95), ground(517, 166, 89, 41, 'sand')],
      rails: [], paddle: point(176, 258), barge: true,
      deck: { x: 224, y: 281, w: 106, h: 56, dx: 86, dy: -97 }
    },
    {
      id: 7, island: 'Orchard Steps', name: 'Twin Spillways', par: 3,
      tee: point(569, 151), cup: point(180, 296), stamp: point(379, 230),
      requirement: 'Stop a backspin chip between chutes',
      hint: 'Use the orchard’s loaner backspin wedge. Chip southwest and stop on the narrow green between the two spillways, then carry the second chute.',
      land: [ground(474, 101, 167, 119), ground(430, 146, 129, 98),
        ground(278, 164, 206, 143), ground(205, 204, 123, 107),
        ground(96, 243, 153, 104), ground(218, 299, 70, 31, 'sand')],
      rails: [], spinGreen: ground(351, 178, 55, 115),
      chutes: [ground(310, 164, 41, 143, 'water'), ground(406, 164, 42, 143, 'water')]
    },
    {
      id: 8, island: 'Orchard Steps', name: 'Pippin Sluice', par: 5,
      tee: point(135, 124), cup: point(575, 271), stamp: point(344, 252),
      requirement: 'Putt from the exposed islet',
      hint: 'Hit the paddle to feed the upper pool. If it arrives full, drain it first. Chip to the exposed lower islet, then putt east to open the landing.',
      land: [ground(65, 86, 193, 98), ground(115, 151, 151, 46),
        ground(170, 171, 78, 38, 'quay'), ground(421, 242, 110, 38, 'quay'),
        ground(489, 212, 159, 111), ground(532, 187, 85, 48),
        ground(493, 297, 61, 34, 'sand')],
      rails: [], paddle: point(184, 155), islet: ground(260, 218, 171, 65)
    }
  ];
})();
