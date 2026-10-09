const worldState = {

    planets: {

        Ultramars: {

            owner: "Combine",

            type: "Capital",

            income: 100,

            cities: {

                "Varkos": "Combine",
                "Karsen": "Combine",
                "New Ardent": "Combine"

            }

        },


        "Free Earth": {

            owner: "Freedom Authority",

            type: "Capital",

            income: 100,

            cities: {

                "New Lisbon": "Freedom Authority",
                "Liberty City": "Freedom Authority",
                "Washington": "Freedom Authority"

            }

        }

    },


    battles: {},


    fleets: {},


    credits: {

        Combine: 0,

        Independents: 0,

        "Freedom Authority": 0

    }

};

function collectPlanetIncome() {

    for (const planetName in worldState.planets) {

        const planet =
            worldState.planets[planetName];

        const cityOwners =
            Object.values(planet.cities);

        const fullyControlled =
            cityOwners.every(
                owner => owner === cityOwners[0]
            );

        if (!fullyControlled) {
            continue;
        }

        const controller =
            cityOwners[0];

        if (
            worldState.credits[controller]
            !== undefined
        ) {

            worldState.credits[controller] +=
                planet.income;

        }

    }

}

setInterval(
    collectPlanetIncome,
    5 * 60 * 1000
);