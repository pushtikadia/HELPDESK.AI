// ... (rest of your component code above)

                                    <Button
                                        type="submit"
                                        disabled={isLoading || isOcrLoading || isTranslating || !issue.trim()}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-14 font-bold text-base transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 group border-none"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} />
                                                <span>{isTranslating ? "Translating..." : "Processing..."}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Analyze Issue</span>
                                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </main>
        </div>
    );
};

export default CreateTicket;
