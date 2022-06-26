Vue.prototype.$storage = Object.freeze({
    // constants
    _clientKey: 'stored-clients',
    // helpers
    _serialize: function (value) {
        return JSON.stringify(value);
    },
    _deserialize: function (dumped) {
        return JSON.parse(dumped);
    },
    initialiseClients: function () {
        if (localStorage.getItem(this._clientKey) === null) {
            let emptyValue = this._serialize({"clients": {}})
            localStorage.setItem(this._clientKey, emptyValue);
        }
    },
    loadAllClients: function () {
        let dumped = localStorage.getItem(this._clientKey)
        let deserialized = this._deserialize(dumped);
        return deserialized["clients"];
    },
    saveClients: function (allClients) {
        let serialized = this._serialize({"clients": allClients});
        localStorage.setItem(this._clientKey, serialized);
    },
    saveTimer: function (clientName, timerDetails) {
        let serialized = this._serialize(timerDetails);
        localStorage.setItem(`${clientName}-timer`, serialized);
    },
    loadTimer: function (clientName) {
        let dumped = localStorage.getItem(`${clientName}-timer`);
        return this._deserialize(dumped);
    },
    clearTimer: function (clientName) {
        localStorage.removeItem(`${clientName}-timer`);
    },
})

Vue.component("single-client", {
    props: {
        clients: Object,
        client: Object,
        now: Number,
    },
    data: function() {
        return {
            manualHours: 0,
            manualMins: 0,
            startTime: null,
            paused: false,
            pausedTime: 0,
            oldNow: null,
        }
    },
    template: `
        <tr :class="{'active-row': startTime !== null && !paused, 'paused': paused}">
            <td>{{ client.name }}</td>
            <td>{{ client.timeWorked | parseTime }}</td>
            <td>
                <input style="width: 40%" type="number" v-model="manualHours"> <span>hours</span>
                <input style="width: 40%" type="number" v-model="manualMins" step="5"> <span>mins</span>
                <button style="width: 70%" @click="addManualTime">Add</button>
            </td>
            <td>
                <div v-if="startTime == null">
                    <button v-if="startTime == null" class="btn btn-outline-success" @click="startTimer">Start</button>
                </div>
                <div v-else>
                    <button v-if="!paused" class="btn btn-outline-warning" @click="pause">Pause</button>
                    <button v-else class="btn btn-outline-warning" @click="restart">Restart</button>
                </div>
                <div v-if="startTime">Started: {{ elapsedTime["minutes"] | parseTime }}</div>
            </td>
            <td>
                <button class="btn btn-outline-secondary" @click="endTimer" :disabled="startTime == null">Stop</button>
            </td>
            <td>
                <ul>
                    <li v-for="(pTime, index) in client.potentialTimes">
                        {{ pTime["minutes"] | parseTime }} 
                        <button class="btn btn-outline-dark" @click="addAutoTime(index)">Add</button> 
                        <button class="btn btn-outline-dark" @click="deleteAutoTime(index)">Delete</button>
                    </li>
                
                </ul>
            </td>
            <td><button class="btn btn-outline-danger" @click="deleteClient">Delete</button></td>
        </tr>
    `,
    created: function() {
        let storedDetails = this.$storage.loadTimer(this.client.name);
        if (storedDetails != null) {
            this.startTime = storedDetails["startTime"];
            this.paused = storedDetails["paused"];
            this.pausedTime = storedDetails["pausedTime"];
        }
    },
    filters: {
        parseTime: function(time) {
            let minutes = parseFloat(time);
            let hours = Math.floor(minutes / 60);
            minutes = Math.floor(minutes) % 60;
            return `${hours}h ${minutes}m`
        },
    },
    computed: {
        elapsedTime: function() {
            if (this.paused && this.oldNow !== null) {
                this.pausedTime += this.now - this.oldNow;
                this.$storage.saveTimer(this.client.name, {
                    'startTime': this.startTime,
                    'paused': this.paused,
                    'pausedTime': this.pausedTime,
                })
            }
            this.oldNow = this.now;
            if (this.startTime !== null) {
                let msElapsed = (this.now - this.startTime) - this.pausedTime;
                return this.parseElapsedTime(msElapsed);
            }
        },
    },
    methods: {
        pause: function() {
            this.paused = true;
        },
        restart: function() {
            this.paused = false;
            this.$storage.saveTimer(this.client.name, {
                'startTime': this.startTime,
                'paused': this.paused,
                'pausedTime': this.pausedTime,
            });
        },
        addTime: function(hours, minutes) {
            let total = parseFloat(this.client.timeWorked);
            if (hours !== 0) {
                let hoursInMins = parseFloat(hours) * 60;
                total += hoursInMins;
            }
            total += parseFloat(minutes);
            Vue.set(this.client, "timeWorked", total);
            this.$storage.saveClients(this.clients);
        },
        deleteAutoTime: function(index) {
            this.client.potentialTimes.splice(index, 1);
            this.$storage.saveClients(this.clients);
        },
        addAutoTime: function(index) {
            let times = this.client.potentialTimes[index];
            let hours = Math.floor(parseFloat(times["minutes"]) / 60);
            let minutes = parseFloat(times["minutes"]) % 60;
            this.addTime(hours, minutes);

            this.deleteAutoTime(index);
        },
        parseElapsedTime: function(milliseconds) {
            let seconds = Math.floor(milliseconds / 1000);
            let minutes = Math.floor(seconds / 60);

            return {"minutes": minutes}
        },
        startTimer: function() {
            this.startTime = Date.now();
            this.$storage.saveTimer(this.client.name, {
                'startTime': this.startTime,
                'paused': this.paused,
                'pausedTime': this.pausedTime,
            })
        },
        endTimer: function() {
            let msElapsed = (Date.now() - this.startTime) - this.pausedTime;
            let parsedTime = this.parseElapsedTime(msElapsed);
            this.client.potentialTimes.push(parsedTime);
            this.$storage.saveClients(this.clients);
            this.$storage.clearTimer(this.client.name);
            this.startTime = null;
            this.pausedTime = 0;
            this.paused = false;
            this.$storage.clearTimer();
        },
        addManualTime: function() {
            this.addTime(this.manualHours, this.manualMins);

            // reset the inputs
            this.manualHours = 0;
            this.manualMins = 0;
        },
        deleteClient: function(e) {
            if (confirm("Are you sure you want to delete this client?")) {
                Vue.delete(this.clients, this.client.name);
            }
            e.preventDefault();
        }
    }
})

Vue.component("client-display", {
    props: {
        clients: Object,
    },
    data: function() {
        return {
            newClient: "",
            now: Date.now(),
        }
    },
    template: `
        <div>
            <h3>Current clients</h3>
            <table class="table">
                <thead>
                    <th scope="col">Name</th>
                    <th scope="col">Time Worked</th>
                    <th scope="col" style="width: 20%">Manually Add Time</th>
                    <th scope="col">Start Clock</th>
                    <th scope="col">Stop Clock</th>
                    <th scope="col">Times to add</th>
                    <th scope="col">Delete</th>
                </thead>
                <tbody>
                    <single-client v-for="(client, name) in clients"
                    :key="name"
                    :now="now"
                    :clients="clients"
                    :client="client">
                    </single-client>
                </tbody>
            </table>
            <form class="add-client-form">
                <input type="text" v-model="newClient">
                <button @click="addClient">Add Client</button>
            </form>
        </div>
    `,
    created: function() {
        let self = this;
        setInterval(function() {
            self.now = Date.now();
        }, 1000);
    },
    computed: {
        noClients: function() {
            return Object.keys(this.clients).length < 1;
        },
    },
    methods: {
        addClient: function(e) {
            if (Object.keys(this.clients).includes(this.newClient)) {
                window.alert("This client already exists");
            } else {
                Vue.set(this.clients, this.newClient, {
                    "name": this.newClient,
                    "timeWorked": 0,
                    "potentialTimes": [],
                });
            }
            this.newClient = "";
            e.preventDefault();
        }
    }
})

window.addEventListener("load", function() {
    var app = new Vue({
        el: "#app",
        data: function() {
            return {
                clients: {},
                latestTimestamps: {},
                output: "",
                showOutput: false,
            }
        },
        template: `
            <div>
                <client-display
                :clients="clients">
                </client-display>

                <button class="btn btn-primary print-output-button" @click="showOutputs" :disabled="showOutput">Show Outputs</button>
                <button class="btn btn-danger clear-all-button" @click="clearTimes">Clear All Times</button>

                <div class="alert alert-primary" v-if="showOutput">
                    <div v-for="client in clients">
                        {{ client.name }}, {{ client.timeWorked }} minutes, {{ parseMinutes(client.timeWorked) }}h
                    </div>
                    <button class="btn btn-outline-primary" @click="hideOutputs">Hide</button>
                </div>
            </div>
        `,
        mounted: function() {
            this.$storage.initialiseClients();
            this.clients = this.$storage.loadAllClients();
        },
        methods: {
            clearTimes: function(e) {
                if (confirm("Are you sure you want to clear all timings?")) {
                    for (const client of Object.values(this.clients)) {
                        Vue.set(client, 'timeWorked', 0);
                        this.$storage.saveClients(this.clients);
                    }
                }
                e.preventDefault();
            },
            showOutputs: function() {
                this.showOutput = true;
            },
            hideOutputs: function() {
                this.showOutput = false;
            },
            parseMinutes: function(minutes) {
                let output = (parseFloat(minutes) / 60)
                return output.toFixed(2);
            }
        },
        watch: {
            clients: function(allClients) {
                this.$storage.saveClients(allClients);
            },
        }
    })
})