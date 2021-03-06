/**
 * Prompt namespace, it's meant for confirmation alerts etc.
 *
 * @class prompt
 * @memberof Partup.client
 */
Partup.client.prompt = {
    // reactive values
    title: new ReactiveVar(),
    message: new ReactiveVar(),
    confirmButton: new ReactiveVar(),
    cancelButton: new ReactiveVar(),
    _active: new ReactiveVar(false),

    /**
     * Confirm hook, is called when the confirm button is clicked
     *
     * @memberof Partup.client.prompt
     */
    onConfirm: function() {
        if (this.confirmCallback) this.confirmCallback();
        this._dismiss();
    },

    /**
     * Cancel hook, is called when the cancel button is clicked
     *
     * @memberof Partup.client.prompt
     */
    onCancel: function() {
        if (this.cancelCallback) this.cancelCallback();
        this._dismiss();
    },

    /**
     * Call confirmation prompt with options
     *
     * @memberof Partup.client.prompt
     * @param {Object} options
     * @param {String} options.title            prompt title text
     * @param {String} options.message          prompt message text
     * @param {String} options.confirmButton    confirm button text
     * @param {String} options.cancelButton     cancel button text
     * @param {Function} options.onConfirm      confirm button click hook
     * @param {Function} options.onCancel       cancel button click hook
     */
    confirm: function(options) {
        this._reset();
        if (options.title)          this.title.set(options.title);
        if (options.message)        this.message.set(options.message);
        if (options.confirmButton)  this.confirmButton.set(options.confirmButton);
        if (options.cancelButton)   this.cancelButton.set(options.cancelButton);
        this.confirmCallback = options.onConfirm || false;
        this.cancelCallback = options.onCancel || false;
        this._active.set(true);
    },

    // is called when the prompt is destroyed
    _dismiss: function() {
        this._active.set(false);
    },

    // resets all values to default
    _reset: function() {
        this.title.set('Alert');
        this.message.set('Are you sure?');
        this.confirmButton.set('Ok');
        this.cancelButton.set('Cancel');
        this.cancelCallback = false;
        this.confirmCallback = false;
    }
};
