/*
    Needle.js is a javascript inline-profiling library which aims to add the least amount of memory and runtime overhead possible. Right now we have a ~0.0004ms overhead per event; 
    For example, 10,000 begin/end blocks adds about ~7ms overhead to your frame.

    Why needle.js?
    console.begin/endTime add too much overhead (~0.02ms per sample), and are not usable for fine-grain sampling. 

    Takes advantage of the fact that static strings should be hashed in JS already. So doing being("foo") will just pass a reference around.
    That being said being("foo" + str(entity.ID)) will add a NEW string to the JS heap, EACH call; So try to stay using static strings.

    Note this library uses window.performance.now(); which is a high-frequency timer; but does add overhead (88% right now) to the overall sampling process.

USAGE:
    needle.init(preAllocatedSampleSize); <-- number of up-front samples you want to allocate for
    needle.begin("start of scope");
    ....do some stuff
    needle.end()

    fine to nest needle scopes
    needle.begin("start of scope");
        needle.begin("MORE scope");
        ....do some stuff
        needle.end()
    needle.end()    
*/

var eNeedleEventType={
    cBegin:1,
    cEnd:2
};

var needle={
    mBatchIndex : 0,    //what's our current batch
    mCurrBatch : null,
    mArraySize : 2048,  //the size of our bucket of samples
    mArrayIndex : 0,    //counter in this bucket

    mBatches:[],

    init:function(preAllocSamples, bucketSize)
    {
        this.mArraySize = bucketSize;
        this.mBatchIndex = 0;
        this.mArrayIndex = 0;

        var numBatches = preAllocSamples / this.mArraySize;

        for(var i =0; i < numBatches; i++)
            this.addBatch();
    },

    addBatch:function()
    {
        var btc = {};
        btc.mSamType = new Uint8Array(this.mArraySize);
        btc.mSamName = new Array();
        btc.mSamTime = new Float64Array(this.mArraySize);

        
        //pre-alloc string array
        btc.mSamName.length = this.mArraySize;


        this.mCurrBatch = btc;
        this.mBatches.push(btc);
    },

    // Called at the start of a scope
    begin:function(name)
    {
        var btch = this.mCurrBatch;

        btch.mSamType[this.mArrayIndex] = eNeedleEventType.cBegin;
        btch.mSamName[this.mArrayIndex] = name;
        btch.mSamTime[this.mArrayIndex] = window.performance.now();

        this.mArrayIndex++;
        if(this.mArrayIndex + 1 >= this.mArraySize)
        {
            if(this.mBatchIndex >= this.mBatches.length-1)
            {
                this.addBatch();
                this.mBatchIndex = this.mBatches.length-1;
            }
            else
            {
                this.mBatchIndex++;
            }
            this.mArrayIndex = 0;
        }
    },

    // Called at the end of a scope.
    end:function()
    {
        var btch = this.mCurrBatch;

        btch.mSamType[this.mArrayIndex] = eNeedleEventType.cEnd;
        btch.mSamTime[this.mArrayIndex] = window.performance.now();

        this.mArrayIndex++;
    },

    // Call this at the end of sampling to get a list of all samples in a usable form
    // don't expect this to be fast; Only call at the end of profiling.
    getExportReadyData:function()
    {
        var oneArray = new Array();
        for (var q =0; q < this.mBatchIndex; q++)
        {
            var bkt = this.mBatches[q];
            for(var i =0; i < this.mArraySize; i++)
            {
                 var evt = {
                    type:bkt.mSamType[i],
                    name:bkt.mSamName[i],
                    time:bkt.mSamTime[i]
                };
                oneArray.push(evt);
            }
        }

        var bkt = this.mBatches[this.mBatchIndex];
            for(var i =0; i < this.mArrayIndex; i++)
            {
                 var evt = {
                    type:bkt.mSamType[i],
                    name:bkt.mSamName[i],
                    time:bkt.mSamTime[i]
                };
                oneArray.push(evt);
            }
        
        return oneArray;
    },

};

// Right now simply dumps linear results out to console; should do something smarter with outputing a about:tracing layout.

needle.consolePrint = function(samples)
{
    var stack = new Array();
    for (var q =0; q < samples.length; q++)
    {
        var evt = samples[q];
        if(evt.type == eNeedleEventType.cBegin)
        {
            stack.push(evt);
        }
        else if(evt.type == eNeedleEventType.cEnd)
        {
            var lastEvt = stack.pop();
            var delta = (evt.time - lastEvt.time ) ;
            //console.log(needle.mLabelArray[lastEvt.name] + ": " + delta + "ms");
            console.log(lastEvt.name + ": " + delta + "ms");
        }   
    }
}