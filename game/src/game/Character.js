class Character {
    constructor(name, className) {
        this.name = name;
        this.className = className;
        this.level = 1;
        this.health = 100;
        this.maxHealth = 100;
        this.strength = 10;
        this.dexterity = 10;
        this.intelligence = 10;
        this.inventory = [];
    }

    levelUp() {
        this.level++;
        this.maxHealth += 10;
        this.health = this.maxHealth;
        this.strength += 2;
        this.dexterity += 2;
        this.intelligence += 2;
    }

    addToInventory(item) {
        this.inventory.push(item);
    }

    removeFromInventory(item) {
        const index = this.inventory.indexOf(item);
        if (index > -1) {
            this.inventory.splice(index, 1);
        }
    }

    toJSON() {
        return {
            name: this.name,
            className: this.className,
            level: this.level,
            health: this.health,
            maxHealth: this.maxHealth,
            strength: this.strength,
            dexterity: this.dexterity,
            intelligence: this.intelligence,
            inventory: this.inventory
        };
    }
}

export default Character;